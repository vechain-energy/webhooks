import { describe, expect, it } from 'vitest';

import { compileMatchers, findMatchingWebhooks } from '../../src/matchers/compileMatchers.js';
import { filterMatches } from '../../src/matchers/filter.js';
import type {
  CompiledWebhook,
  RenderContext,
  TransferCandidate
} from '../../src/shared/types.js';

const genericWebhook: CompiledWebhook = {
  sourcePath: '/tmp/generic.yml',
  config: {
    version: 1,
    id: 'generic-transfer',
    enabled: true,
    match: {
      kind: 'transfer'
    },
    request: {
      method: 'POST',
      url: 'https://example.com'
    }
  },
  normalizedAddresses: []
};

const addressWebhook: CompiledWebhook = {
  sourcePath: '/tmp/address.yml',
  config: {
    version: 1,
    id: 'address-transfer',
    enabled: true,
    match: {
      kind: 'transfer',
      addresses: ['0xabc']
    },
    request: {
      method: 'POST',
      url: 'https://example.com'
    }
  },
  normalizedAddresses: ['0xabc']
};

describe('matchers', () => {
  it('matches transfer webhooks by sender or recipient and keeps generic matches', () => {
    const matcherIndex = compileMatchers([genericWebhook, addressWebhook]);
    const candidate: TransferCandidate = {
      kind: 'transfer',
      event: {
        sender: '0xabc',
        recipient: '0xdef',
        amount: '1',
        meta: {
          blockID: '0x1',
          blockNumber: 1,
          blockTimestamp: 1,
          txID: '0xtx',
          txOrigin: '0xabc',
          candidateId: 'transfer:0xtx:0:0'
        }
      },
      meta: {
        blockID: '0x1',
        blockNumber: 1,
        blockTimestamp: 1,
        txID: '0xtx',
        txOrigin: '0xabc',
        candidateId: 'transfer:0xtx:0:0'
      }
    };

    const matches = findMatchingWebhooks(matcherIndex, candidate);

    expect(matches.map((webhook) => webhook.config.id).sort()).toEqual([
      'address-transfer',
      'generic-transfer'
    ]);
  });

  it('evaluates filter paths against decoded, event, and meta fields', () => {
    const context: RenderContext = {
      decoded: {
        amount: '12'
      },
      event: {
        sender: '0xabc'
      },
      meta: {
        txID: '0xtx'
      },
      network: {
        name: 'test'
      },
      webhook: {
        id: 'transfer-alert'
      }
    };

    expect(
      filterMatches(
        [
          { field: 'decoded.amount', op: 'gt', value: '10' },
          { field: 'sender', op: 'in', values: ['0xabc'] },
          { field: 'meta.txID', op: 'eq', value: '0xtx' }
        ],
        context
      )
    ).toBe(true);
  });
});
