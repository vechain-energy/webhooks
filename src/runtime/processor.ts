import type { Logger } from 'pino';

import { findMatchingWebhooks, compileMatchers } from '../matchers/compileMatchers.js';
import { deriveCandidates } from '../matchers/candidates.js';
import { decodeCandidate } from '../matchers/decode.js';
import { filterMatches } from '../matchers/filter.js';
import { renderRequest } from '../delivery/renderRequest.js';
import { sendWebhook } from '../delivery/sendWebhook.js';
import { createBlockSubscription, type BlockSubscription } from '../network/blockSubscription.js';
import { createThorClient, type ThorClient } from '../network/thorClient.js';
import type {
  CompiledProject,
  CompiledWebhook,
  MatcherIndex,
  ProcessorState,
  RenderContext,
  ThorBlock
} from '../shared/types.js';

export interface Processor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(): ProcessorState;
}

export function createProcessor(options: {
  project: CompiledProject;
  logger: Logger;
  thorClient?: ThorClient;
  subscriptionFactory?: (handlers: {
    onBlock: (blockNumber: number) => Promise<void>;
    onConnectionChange: (connected: boolean) => void;
    onError: (message: string) => void;
  }) => BlockSubscription;
}): Processor {
  const { logger, project, subscriptionFactory } = options;
  const thorClient =
    options.thorClient ??
    createThorClient({
      nodeUrl: project.runtimeConfig.nodeUrl,
      logger
    });
  const matcherIndex = compileMatchers(project.webhooks);
  const state: ProcessorState = {
    ready: false,
    connected: false,
    loadedWebhooks: project.webhooks.filter((webhook) => webhook.config.enabled).length,
    startedAt: new Date().toISOString()
  };

  let running = false;
  let subscription: BlockSubscription | undefined;
  let activeProcessing: Promise<void> = Promise.resolve();

  return {
    async start() {
      if (running) {
        return;
      }

      running = true;
      await replayStartupWindow();
      subscription = createSubscription();
      void subscription.start();
    },
    async stop() {
      running = false;
      await subscription?.stop();
      await activeProcessing;
      state.connected = false;
      state.ready = false;
    },
    getState() {
      return { ...state };
    }
  };

  async function replayStartupWindow(): Promise<void> {
    const bestBlock = await thorClient.getBestBlock();
    const finalizedBlockNumber = Math.max(
      0,
      bestBlock.number - project.runtimeConfig.processing.confirmations
    );
    const replayWindowBlocks = project.runtimeConfig.processing.replayWindowBlocks;
    const startBlockNumber = Math.max(0, finalizedBlockNumber - replayWindowBlocks + 1);

    logger.info(
      {
        startBlockNumber,
        finalizedBlockNumber
      },
      'Replaying startup window'
    );

    for (let blockNumber = startBlockNumber; blockNumber <= finalizedBlockNumber; blockNumber += 1) {
      await processBlockNumber(blockNumber);
    }

    state.ready = true;
    state.lastObservedBlockNumber = bestBlock.number;
    state.lastObservedBlockId = bestBlock.id;
  }

  function createSubscription(): BlockSubscription {
    const buildSubscription =
      subscriptionFactory ??
      ((handlers: {
        onBlock: (blockNumber: number) => Promise<void>;
        onConnectionChange: (connected: boolean) => void;
        onError: (message: string) => void;
      }) =>
        createBlockSubscription({
          nodeUrl: project.runtimeConfig.nodeUrl,
          logger,
          onBlock: async (notification) => handlers.onBlock(notification.number),
          onConnectionChange: handlers.onConnectionChange,
          onError: handlers.onError
        }));

    return buildSubscription({
      onBlock: async (blockNumber) => {
        activeProcessing = activeProcessing.then(async () => {
          await handleLiveBlock(blockNumber);
        });
        await activeProcessing;
      },
      onConnectionChange: (connected) => {
        state.connected = connected;
      },
      onError: (message) => {
        state.lastError = message;
      }
    });
  }

  async function handleLiveBlock(observedBlockNumber: number): Promise<void> {
    state.lastObservedBlockNumber = observedBlockNumber;
    const finalizedBlockNumber = observedBlockNumber - project.runtimeConfig.processing.confirmations;

    if (finalizedBlockNumber <= 0) {
      return;
    }

    const nextBlockNumber = (state.lastProcessedBlockNumber ?? 0) + 1;
    if (finalizedBlockNumber < nextBlockNumber) {
      return;
    }

    await resumeAwareReplay(nextBlockNumber, finalizedBlockNumber);
  }

  async function resumeAwareReplay(
    startBlockNumber: number,
    endBlockNumber: number
  ): Promise<void> {
    const lastProcessedBlockNumber = state.lastProcessedBlockNumber;
    const lastProcessedBlockId = state.lastProcessedBlockId;
    if (lastProcessedBlockNumber && lastProcessedBlockId) {
      const currentBlock = await thorClient.getBlock(lastProcessedBlockNumber);
      if (currentBlock.id !== lastProcessedBlockId) {
        logger.warn(
          {
            expectedBlockId: lastProcessedBlockId,
            actualBlockId: currentBlock.id,
            blockNumber: lastProcessedBlockNumber
          },
          'Detected a block mismatch while resuming. Replaying the configured startup window.'
        );

        const replayWindowBlocks = project.runtimeConfig.processing.replayWindowBlocks;
        const replayStart = Math.max(0, endBlockNumber - replayWindowBlocks + 1);
        for (let blockNumber = replayStart; blockNumber <= endBlockNumber; blockNumber += 1) {
          await processBlockNumber(blockNumber);
        }
        return;
      }
    }

    for (let blockNumber = startBlockNumber; blockNumber <= endBlockNumber; blockNumber += 1) {
      await processBlockNumber(blockNumber);
    }
  }

  async function processBlockNumber(blockNumber: number): Promise<void> {
    if (!running && state.ready) {
      return;
    }

    const block = await thorClient.getBlock(blockNumber);
    await processBlock(block, matcherIndex);
    state.lastProcessedBlockNumber = block.number;
    state.lastProcessedBlockId = block.id;
  }

  async function processBlock(
    block: ThorBlock,
    index: MatcherIndex
  ): Promise<void> {
    const candidates = deriveCandidates(block);

    for (const candidate of candidates) {
      const matchingWebhooks = findMatchingWebhooks(index, candidate);

      for (const webhook of matchingWebhooks) {
        await processWebhookCandidate(webhook, candidate);
      }
    }
  }

  async function processWebhookCandidate(
    webhook: CompiledWebhook,
    candidate: ThorBlock extends never ? never : ReturnType<typeof deriveCandidates>[number]
  ): Promise<void> {
    const decoded = decodeCandidate(candidate, webhook);
    const context = createRenderContext(project, webhook, candidate.event, decoded);

    if (!filterMatches(webhook.config.filters, context)) {
      return;
    }

    const request = renderRequest({
      webhook,
      context,
      runtimeConfig: project.runtimeConfig,
      env: process.env
    });

    try {
      const result = await sendWebhook({
        request,
        runtimeConfig: project.runtimeConfig,
        logger
      });
      logger.info(
        {
          webhookId: webhook.config.id,
          candidateId: candidate.meta.candidateId,
          statusCode: result.statusCode
        },
        'Webhook delivered'
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Webhook delivery failed for an unknown reason.';
      state.lastError = message;
      logger.error(
        {
          webhookId: webhook.config.id,
          candidateId: candidate.meta.candidateId,
          error: message
        },
        'Webhook delivery failed'
      );
    }
  }
}

function createRenderContext(
  project: CompiledProject,
  webhook: CompiledWebhook,
  event: Record<string, unknown>,
  decoded: Record<string, unknown>
): RenderContext {
  const meta = event.meta;

  return {
    decoded,
    event,
    meta: meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {},
    network: {
      name: project.runtimeConfig.network
    },
    webhook: {
      id: webhook.config.id
    }
  };
}
