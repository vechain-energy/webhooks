import BigNumber from 'bignumber.js';
import { formatEther } from 'ethers';
import * as Web3EthAbi from 'web3-eth-abi';

import { ConfigurationError } from '../shared/errors.js';
import type {
  Candidate,
  CompiledWebhook,
  DecodeFieldConfig
} from '../shared/types.js';

type DecodedPayload = Record<string, unknown>;

export function decodeCandidate(
  candidate: Candidate,
  webhook: CompiledWebhook
): DecodedPayload {
  const decoded = (() => {
    switch (candidate.kind) {
      case 'event':
        return decodeEventCandidate(candidate, webhook);
      case 'transfer':
        return decodeTransferCandidate(candidate);
      case 'transaction':
        return decodeTransactionCandidate(candidate);
      case 'clause':
        return decodeClauseCandidate(candidate);
    }
  })();

  return applyDecodeHints(decoded, webhook.config.decode?.fields ?? {});
}

function decodeEventCandidate(
  candidate: Extract<Candidate, { kind: 'event' }>,
  webhook: CompiledWebhook
): DecodedPayload {
  const fragment = webhook.eventMatcher?.fragment;
  if (!fragment) {
    throw new ConfigurationError(
      `Webhook "${webhook.config.id}" is missing a compiled event fragment. Re-run validation and fix the event ABI configuration.`
    );
  }

  const decoded: Record<string, unknown> = {};
  const { data, topics } = candidate.event;
  const nonIndexedInputs = fragment.inputs.filter((input) => input.indexed !== true);
  const nonIndexedData =
    nonIndexedInputs.length > 0
      ? (Web3EthAbi.decodeParameters(
          nonIndexedInputs as Parameters<typeof Web3EthAbi.decodeParameters>[0],
          data
        ) as Record<string, unknown>)
      : {};
  let indexedIndex = 0;

  fragment.inputs.forEach((input, index) => {
    const decodedValue =
      input.indexed === true
        ? Web3EthAbi.decodeParameter(input.type, topics[indexedIndex + 1] ?? '0x')
        : nonIndexedData[String(index - indexedIndex)];

    if (input.indexed === true) {
      indexedIndex += 1;
    }

    decoded[input.name || String(index)] = decodedValue;
  });

  return decoded;
}

function decodeTransferCandidate(
  candidate: Extract<Candidate, { kind: 'transfer' }>
): DecodedPayload {
  const amount = candidate.event.amount
    ? new BigNumber(candidate.event.amount).toString()
    : null;

  return {
    from: candidate.event.sender,
    to: candidate.event.recipient,
    amount
  };
}

function decodeTransactionCandidate(
  candidate: Extract<Candidate, { kind: 'transaction' }>
): DecodedPayload {
  const { event } = candidate;

  return {
    origin: event.origin,
    delegator: event.delegator ?? '',
    gasPayer: event.gasPayer ?? '',
    blockRef: event.blockRef ?? '',
    nonce: event.nonce ?? '',
    dependsOn: event.dependsOn ?? '',
    chainTag: event.chainTag ?? '',
    expiration: event.expiration ?? '',
    gasPriceCoef: event.gasPriceCoef ?? '',
    gas: event.gas ?? '',
    gasUsed: event.gasUsed ?? '',
    size: event.size ?? '',
    reverted: event.reverted ?? false,
    paid: event.paid ? new BigNumber(event.paid).toString() : null,
    reward: event.reward ? new BigNumber(event.reward).toString() : null
  };
}

function decodeClauseCandidate(
  candidate: Extract<Candidate, { kind: 'clause' }>
): DecodedPayload {
  const { event, meta } = candidate;
  const rawValue = event.value ?? null;

  return {
    origin: meta.txOrigin,
    to: event.to ?? '',
    value: rawValue ? new BigNumber(rawValue).toString() : null,
    data: event.data ?? '',
    clauseIndex: meta.clauseIndex ?? 0
  };
}

function applyDecodeHints(
  decoded: DecodedPayload,
  fields: Record<string, DecodeFieldConfig>
): DecodedPayload {
  const nextDecoded = { ...decoded };

  for (const [field, hints] of Object.entries(fields) as Array<
    [string, DecodeFieldConfig]
  >) {
    const currentValue = nextDecoded[field];
    if (currentValue === undefined) {
      continue;
    }

    if (hints.format === 'ether' && typeof currentValue === 'string') {
      nextDecoded[field] = formatEther(currentValue);
    }

    if (hints.bytes === 'utf8') {
      nextDecoded[field] = decodeBytesToUtf8(nextDecoded[field]);
    }
  }

  return nextDecoded;
}

function decodeBytesToUtf8(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeBytesToUtf8(entry));
  }

  if (typeof value !== 'string' || !value.startsWith('0x')) {
    return value;
  }

  return Buffer.from(value.slice(2), 'hex')
    .toString('utf8')
    .replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, '');
}
