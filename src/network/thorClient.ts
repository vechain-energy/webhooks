import type { Logger } from 'pino';

import { DeliveryError } from '../shared/errors.js';
import type { ThorBlock } from '../shared/types.js';

export interface ThorClient {
  getBestBlock(): Promise<{ number: number; id: string }>;
  getBlock(blockNumber: number): Promise<ThorBlock>;
}

export function createThorClient(options: {
  nodeUrl: string;
  logger: Logger;
}): ThorClient {
  const { logger, nodeUrl } = options;

  return {
    async getBestBlock() {
      return fetchJson<{ number: number; id: string }>('/blocks/best');
    },
    async getBlock(blockNumber: number) {
      return fetchJson<ThorBlock>(`/blocks/${blockNumber}?expanded=true`);
    }
  };

  async function fetchJson<T>(path: string): Promise<T> {
    const url = `${nodeUrl.replace(/\/$/, '')}${path}`;
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      logger.warn(
        {
          path,
          statusCode: response.status,
          body
        },
        'Thor API request failed'
      );
      throw new DeliveryError(
        `Thor API request failed with status ${response.status}. Check nodeUrl and ensure the VeChain node is reachable.`
      );
    }

    return await response.json() as T;
  }
}
