import { describe, expect, it } from 'vitest';

import { renderRequest } from '../../src/delivery/renderRequest.js';
import type { CompiledWebhook, RenderContext, RuntimeConfig } from '../../src/shared/types.js';

const runtimeConfig: RuntimeConfig = {
  version: 1,
  network: 'test',
  nodeUrl: 'https://node-testnet.vechain.energy',
  server: {
    port: 8080
  },
  processing: {
    confirmations: 12,
    replayWindowBlocks: 64
  },
  delivery: {
    requestTimeoutMs: 10000,
    maxAttempts: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 16000,
    defaultHeaders: {
      'x-default': 'true'
    },
    signing: {
      defaultEnabled: false,
      header: 'x-webhook-signature'
    }
  },
  logLevel: 'info'
};

const context: RenderContext = {
  decoded: {
    amount: '100'
  },
  event: {
    sender: '0xabc'
  },
  meta: {
    txID: '0xtx',
    candidateId: 'transfer:0xtx:0:0'
  },
  network: {
    name: 'test'
  },
  webhook: {
    id: 'transfer-alert'
  }
};

describe('renderRequest', () => {
  it('renders body templates and signs requests when configured', () => {
    const webhook: CompiledWebhook = {
      sourcePath: '/tmp/transfer.yml',
      normalizedAddresses: [],
      config: {
        version: 1,
        id: 'transfer-alert',
        enabled: true,
        match: {
          kind: 'transfer'
        },
        request: {
          method: 'POST',
          url: 'https://example.com/hooks/{{webhook.id}}',
          headers: {
            'x-network': '{{network.name}}'
          },
          body: '{"txId":"{{meta.txID}}","amount":"{{decoded.amount}}"}',
          signing: {
            enabled: true,
            secretEnv: 'WEBHOOK_SIGNATURE_SECRET'
          }
        }
      }
    };

    const request = renderRequest({
      webhook,
      context,
      runtimeConfig,
      env: {
        WEBHOOK_SIGNATURE_SECRET: 'secret'
      }
    });

    expect(request.url).toBe('https://example.com/hooks/transfer-alert');
    expect(request.headers['x-network']).toBe('test');
    expect(request.headers['x-webhook-signature']).toMatch(/^[a-f0-9]{64}$/);
    expect(request.body).toContain('"amount":"100"');
  });

  it('fails loudly when a template references a missing field', () => {
    const webhook: CompiledWebhook = {
      sourcePath: '/tmp/broken.yml',
      normalizedAddresses: [],
      config: {
        version: 1,
        id: 'broken',
        enabled: true,
        match: {
          kind: 'transfer'
        },
        request: {
          method: 'POST',
          url: 'https://example.com/{{decoded.missing}}'
        }
      }
    };

    expect(() =>
      renderRequest({
        webhook,
        context,
        runtimeConfig,
        env: {}
      })
    ).toThrow();
  });
});
