import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadProjectConfig } from '../../src/config/loadProjectConfig.js';
import { ConfigurationError } from '../../src/shared/errors.js';

async function writeProjectFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vechain-webhooks-config-'));
  await mkdir(join(root, 'config', 'webhooks'), { recursive: true });
  await mkdir(join(root, 'config', 'abis'), { recursive: true });

  await writeFile(
    join(root, 'config', 'runtime.yml'),
    `version: 1
network: test
nodeUrl: https://node-testnet.vechain.energy
server:
  port: 8080
processing:
  confirmations: 12
  replayWindowBlocks: 64
delivery:
  requestTimeoutMs: 10000
  maxAttempts: 5
  initialBackoffMs: 1000
  maxBackoffMs: 16000
  defaultHeaders: {}
  signing:
    defaultEnabled: false
    header: x-webhook-signature
logLevel: info
`
  );

  await writeFile(
    join(root, 'config', 'abis', 'erc20.json'),
    JSON.stringify([
      {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' }
        ]
      }
    ])
  );

  return root;
}

describe('loadProjectConfig', () => {
  it('loads runtime and webhook config and compiles event topics from ABI files', async () => {
    const root = await writeProjectFixture();
    await writeFile(
      join(root, 'config', 'webhooks', 'erc20.yml'),
      `version: 1
id: erc20-transfer
enabled: true
match:
  kind: event
  event:
    name: Transfer
    abi:
      file: ../abis/erc20.json
request:
  method: POST
  url: https://example.com
`
    );

    const project = await loadProjectConfig(join(root, 'config', 'runtime.yml'));

    expect(project.runtimeConfig.network).toBe('test');
    expect(project.webhooks).toHaveLength(1);
    expect(project.webhooks[0]?.eventMatcher?.topic0).toBe(
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );
  });

  it('returns instructive validation errors when an event webhook defines two ABI sources', async () => {
    const root = await writeProjectFixture();
    await writeFile(
      join(root, 'config', 'webhooks', 'broken.yml'),
      `version: 1
id: broken
enabled: true
match:
  kind: event
  event:
    name: Transfer
    abi:
      inline:
        type: event
        name: Transfer
        inputs: []
      file: ../abis/erc20.json
request:
  method: POST
  url: https://example.com
`
    );

    await expect(
      loadProjectConfig(join(root, 'config', 'runtime.yml'))
    ).rejects.toThrowError(ConfigurationError);
    await expect(
      loadProjectConfig(join(root, 'config', 'runtime.yml'))
    ).rejects.toThrow(/exactly one ABI source/);
  });
});
