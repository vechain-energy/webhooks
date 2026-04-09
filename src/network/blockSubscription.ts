import { setTimeout as delay } from 'node:timers/promises';

import type { Logger } from 'pino';
import WebSocket from 'ws';

import type { BlockNotification } from '../shared/types.js';
import { resolveBlockSubscriptionUrl } from './resolveSubscriptionUrl.js';

export interface BlockSubscription {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createBlockSubscription(options: {
  nodeUrl: string;
  logger: Logger;
  onBlock: (block: BlockNotification) => Promise<void>;
  onConnectionChange: (connected: boolean) => void;
  onError: (message: string) => void;
  reconnectDelayMs?: number;
}): BlockSubscription {
  const {
    logger,
    nodeUrl,
    onBlock,
    onConnectionChange,
    onError,
    reconnectDelayMs = 3000
  } = options;

  const websocketUrl = resolveBlockSubscriptionUrl(nodeUrl);
  let socket: WebSocket | undefined;
  let running = false;

  return {
    async start() {
      running = true;
      await connectLoop();
    },
    async stop() {
      running = false;
      if (!socket) {
        return;
      }

      await new Promise<void>((resolve) => {
        socket?.once('close', () => resolve());
        socket?.close();
      });
    }
  };

  async function connectLoop(): Promise<void> {
    while (running) {
      try {
        await connectOnce();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown WebSocket error.';
        onError(message);
        logger.warn({ error: message }, 'Block subscription disconnected');
      }

      onConnectionChange(false);
      if (!running) {
        break;
      }

      await delay(reconnectDelayMs);
    }
  }

  async function connectOnce(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      socket = new WebSocket(websocketUrl);

      socket.once('open', () => {
        onConnectionChange(true);
        logger.info({ websocketUrl }, 'Connected to block subscription');
      });

      socket.on('message', (payload) => {
        void handleMessage(payload);
      });

      socket.once('error', (error) => {
        reject(error);
      });

      socket.once('close', () => {
        resolve();
      });
    });
  }

  async function handleMessage(payload: WebSocket.RawData): Promise<void> {
    const stringPayload = payload.toString();
    try {
      const parsedPayload = JSON.parse(stringPayload) as unknown;
      const number = normalizeNotification(parsedPayload);
      if (number === undefined) {
        return;
      }

      await onBlock({ number });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The subscription payload could not be parsed.';
      onError(message);
      logger.warn({ payload: stringPayload, error: message }, 'Ignoring invalid block notification');
    }
  }
}

function normalizeNotification(payload: unknown): number | undefined {
  if (typeof payload === 'number') {
    return payload;
  }

  if (typeof payload === 'string') {
    const number = Number(payload);
    return Number.isInteger(number) ? number : undefined;
  }

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const number = (payload as Record<string, unknown>).number;
  if (typeof number === 'number') {
    return number;
  }

  if (typeof number === 'string') {
    const parsed = Number(number);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
}
