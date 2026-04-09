import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import type { ThorClient } from '../../src/network/thorClient.js';
import { createProcessor } from '../../src/runtime/processor.js';
import { createLogger } from '../../src/shared/logger.js';
import type {
  CompiledProject,
  CompiledWebhook,
  ProcessorState,
  ThorBlock
} from '../../src/shared/types.js';

function createTransferBlock(blockNumber: number): ThorBlock {
  return {
    number: blockNumber,
    id: `0xblock-${blockNumber}`,
    timestamp: blockNumber,
    transactions: [
      {
        id: `0xtx-${blockNumber}`,
        origin: '0x0000000000000000000000000000456e65726779',
        clauses: [
          {
            to: '0x0000000000000000000000000000456e65726779',
            value: '0',
            data: '0x'
          }
        ],
        outputs: [
          {
            transfers: [
              {
                sender: '0x0000000000000000000000000000456e65726779',
                recipient: '0x0000000000000000000000000000000000000001',
                amount: '1000000000000000000'
              }
            ],
            events: []
          }
        ],
        meta: {
          blockID: '',
          blockNumber,
          blockTimestamp: blockNumber,
          txID: `0xtx-${blockNumber}`,
          txOrigin: '0x0000000000000000000000000000456e65726779',
          candidateId: ''
        }
      }
    ]
  };
}

describe('processor', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let subscriptionHandlers:
    | {
        onBlock: (blockNumber: number) => Promise<void>;
        onConnectionChange: (connected: boolean) => void;
        onError: (message: string) => void;
      }
    | undefined;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    subscriptionHandlers = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('replays finalized blocks on startup and processes new finalized blocks from the live stream', async () => {
    const thorClient: ThorClient = {
      async getBestBlock() {
        return {
          number: 15,
          id: '0xbest'
        };
      },
      async getBlock(blockNumber: number) {
        return createTransferBlock(blockNumber);
      }
    };

    const webhook: CompiledWebhook = {
      sourcePath: '/tmp/transfer.yml',
      normalizedAddresses: ['0x0000000000000000000000000000456e65726779'],
      config: {
        version: 1,
        id: 'transfer-alert',
        enabled: true,
        match: {
          kind: 'transfer',
          addresses: ['0x0000000000000000000000000000456e65726779']
        },
        request: {
          method: 'POST',
          url: 'https://example.com/hooks/transfer',
          contentType: 'application/json',
          body: '{"txId":"{{meta.txID}}","amount":"{{decoded.amount}}"}'
        }
      }
    };

    const project: CompiledProject = {
      rootDirectory: '/tmp',
      runtimeConfigPath: '/tmp/config/runtime.yml',
      runtimeConfig: {
        version: 1,
        network: 'test',
        nodeUrl: 'https://node-testnet.vechain.energy',
        server: {
          port: 8080
        },
        processing: {
          confirmations: 2,
          replayWindowBlocks: 3
        },
        delivery: {
          requestTimeoutMs: 10000,
          maxAttempts: 1,
          initialBackoffMs: 1,
          maxBackoffMs: 1,
          defaultHeaders: {},
          signing: {
            defaultEnabled: false,
            header: 'x-webhook-signature'
          }
        },
        logLevel: 'info'
      },
      webhooks: [webhook]
    };

    const processor = createProcessor({
      project,
      logger: createLogger('info'),
      thorClient,
      subscriptionFactory: (handlers) => {
        subscriptionHandlers = handlers;
        return {
          async start() {
            handlers.onConnectionChange(true);
          },
          async stop() {
            handlers.onConnectionChange(false);
          }
        };
      }
    });

    await processor.start();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const initialState = processor.getState();
    expect(initialState.ready).toBe(true);
    expect(initialState.lastProcessedBlockNumber).toBe(13);

    await subscriptionHandlers?.onBlock(16);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const stateAfterLiveBlock = processor.getState();
    expect(stateAfterLiveBlock.lastProcessedBlockNumber).toBe(14);
    expect(stateAfterLiveBlock.connected).toBe(true);

    await processor.stop();

    const finalState: ProcessorState = processor.getState();
    expect(finalState.ready).toBe(false);
    expect(finalState.connected).toBe(false);
  });
});
