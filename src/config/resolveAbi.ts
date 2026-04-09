import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import * as Web3EthAbi from 'web3-eth-abi';

import { ConfigurationError } from '../shared/errors.js';
import type { AbiEventFragment } from '../shared/types.js';

function toAbiList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object' && 'abi' in value) {
    const nested = (value as Record<string, unknown>).abi;
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
}

function isAbiEventFragment(value: unknown): value is AbiEventFragment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' && Array.isArray(record.inputs);
}

export async function resolveEventFragment(options: {
  eventName: string;
  inlineAbi: unknown | undefined;
  abiFile: string | undefined;
  webhookPath: string;
}): Promise<{ fragment: AbiEventFragment; topic0: string }> {
  const { abiFile, eventName, inlineAbi, webhookPath } = options;

  const rawAbi = inlineAbi ?? await loadAbiFile({
    abiFile,
    webhookPath
  });
  const abiList = toAbiList(rawAbi);
  const fragment = abiList.find((item) => {
    if (!isAbiEventFragment(item)) {
      return false;
    }

    return item.name === eventName && (item.type === undefined || item.type === 'event');
  });

  if (!fragment || !isAbiEventFragment(fragment)) {
    throw new ConfigurationError(
      `Webhook "${webhookPath}" references event "${eventName}", but the ABI does not define that event. Update match.event.name or supply the correct ABI file.`
    );
  }

  const topic0 = String(
    Web3EthAbi.encodeEventSignature(
      fragment as unknown as Parameters<typeof Web3EthAbi.encodeEventSignature>[0]
    )
  ).toLowerCase();
  return {
    fragment,
    topic0
  };
}

async function loadAbiFile(options: {
  abiFile: string | undefined;
  webhookPath: string;
}): Promise<unknown> {
  const { abiFile, webhookPath } = options;

  if (!abiFile) {
    throw new ConfigurationError(
      `Webhook "${webhookPath}" must define an ABI source. Set match.event.abi.inline or match.event.abi.file.`
    );
  }

  const resolvedPath = resolve(dirname(webhookPath), abiFile);
  const fileContents = await readFile(resolvedPath, 'utf8');
  return JSON.parse(fileContents) as unknown;
}
