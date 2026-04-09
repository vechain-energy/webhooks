import * as Web3EthAbi from 'web3-eth-abi';

import { deriveCandidates } from '../matchers/candidates.js';
import type {
  AbiInput,
  Candidate,
  ThorBlock,
  ThorTransaction
} from '../shared/types.js';
import type {
  AnalyzedTriggerOption,
  ParsedDecoderBundle,
  EventDescriptor,
  FunctionDescriptor,
  TransactionDetailResponse,
  TransactionReceiptResponse
} from './types.js';

export function buildTriggerOptions(options: {
  decoderBundle: ParsedDecoderBundle;
  receipt: TransactionReceiptResponse;
  transaction: TransactionDetailResponse;
}): AnalyzedTriggerOption[] {
  const candidates = buildCandidatesFromTransaction(options.transaction, options.receipt);
  const dedupedTriggers = new Map<string, AnalyzedTriggerOption>();

  for (const candidate of candidates) {
    const trigger = createTriggerOption(candidate, options.decoderBundle);
    const current = dedupedTriggers.get(trigger.dedupeKey);

    if (current) {
      current.occurrenceCount += 1;
      continue;
    }

    dedupedTriggers.set(trigger.dedupeKey, trigger);
  }

  return [...dedupedTriggers.values()];
}

export function buildCandidatesFromTransaction(
  transaction: TransactionDetailResponse,
  receipt: TransactionReceiptResponse
): Candidate[] {
  const block: ThorBlock = {
    number: receipt.meta.blockNumber,
    id: receipt.meta.blockID,
    timestamp: receipt.meta.blockTimestamp,
    transactions: [buildThorTransaction(transaction, receipt)]
  };

  return deriveCandidates(block);
}

function buildThorTransaction(
  transaction: TransactionDetailResponse,
  receipt: TransactionReceiptResponse
): ThorTransaction {
  return {
    id: transaction.id,
    origin: transaction.origin,
    delegator: transaction.delegator ?? null,
    gasPayer: transaction.gasPayer ?? receipt.gasPayer,
    blockRef: transaction.blockRef ?? '',
    nonce: transaction.nonce ?? '',
    dependsOn: transaction.dependsOn ?? null,
    chainTag: transaction.chainTag ?? 0,
    expiration: transaction.expiration ?? 0,
    gasPriceCoef: transaction.gasPriceCoef ?? 0,
    gas: transaction.gas ?? 0,
    gasUsed: receipt.gasUsed,
    size: transaction.size ?? 0,
    reverted: receipt.reverted,
    paid: receipt.paid,
    reward: receipt.reward,
    clauses: transaction.clauses.map((clause) => ({
      ...(clause.to !== undefined ? { to: clause.to } : {}),
      ...(clause.value !== undefined ? { value: clause.value } : {}),
      ...(clause.data !== undefined ? { data: clause.data } : {})
    })),
    outputs: receipt.outputs.map((output) => ({
      events: output.events.map((event) => ({
        address: event.address,
        topics: event.topics,
        data: event.data
      })),
      transfers: output.transfers.map((transfer) => ({
        sender: transfer.sender,
        recipient: transfer.recipient,
        amount: transfer.amount
      }))
    })),
    meta: {
      blockID: receipt.meta.blockID,
      blockNumber: receipt.meta.blockNumber,
      blockTimestamp: receipt.meta.blockTimestamp,
      txID: receipt.meta.txID,
      txOrigin: receipt.meta.txOrigin,
      candidateId: `transaction:${transaction.id}`
    }
  };
}

function createTriggerOption(
  candidate: Candidate,
  decoderBundle: ParsedDecoderBundle
): AnalyzedTriggerOption {
  switch (candidate.kind) {
    case 'transaction':
      return createTransactionTrigger(candidate);
    case 'transfer':
      return createTransferTrigger(candidate);
    case 'clause':
      return createClauseTrigger(candidate, decoderBundle);
    case 'event':
      return createEventTrigger(candidate, decoderBundle);
  }
}

function createTransactionTrigger(
  candidate: Extract<Candidate, { kind: 'transaction' }>
): AnalyzedTriggerOption {
  const origin = candidate.event.origin.toLowerCase();

  return {
    id: `transaction:${origin}`,
    dedupeKey: `transaction:${origin}`,
    kind: 'transaction',
    title: `Transactions from ${shortAddress(origin)}`,
    subtitle: `Origin ${origin}`,
    occurrenceCount: 1,
    addresses: [origin],
    candidate,
    decoded: {
      origin: candidate.event.origin,
      gas: candidate.event.gas ?? '',
      gasUsed: candidate.event.gasUsed ?? '',
      reverted: candidate.event.reverted ?? false
    },
    selectionStatus: 'ready'
  };
}

function createTransferTrigger(
  candidate: Extract<Candidate, { kind: 'transfer' }>
): AnalyzedTriggerOption {
  const sender = candidate.event.sender.toLowerCase();
  const recipient = candidate.event.recipient.toLowerCase();
  const sortedAddresses = [sender, recipient].sort();

  return {
    id: `transfer:${sortedAddresses.join(':')}`,
    dedupeKey: `transfer:${sortedAddresses.join(':')}`,
    kind: 'transfer',
    title: `Transfer between ${shortAddress(sender)} and ${shortAddress(recipient)}`,
    subtitle: `Amount ${candidate.event.amount}`,
    occurrenceCount: 1,
    addresses: [sender, recipient],
    candidate,
    decoded: {
      from: candidate.event.sender,
      to: candidate.event.recipient,
      amount: candidate.event.amount
    },
    selectionStatus: 'ready'
  };
}

function createClauseTrigger(
  candidate: Extract<Candidate, { kind: 'clause' }>,
  decoderBundle: ParsedDecoderBundle
): AnalyzedTriggerOption {
  const to = String(candidate.event.to ?? '').toLowerCase();
  const functionDescriptor = resolveFunctionDescriptor(candidate.event.data ?? '', decoderBundle);
  const decodedArguments = decodeFunctionArguments(candidate.event.data ?? '', functionDescriptor);

  return {
    id: `clause:${to || 'generic'}`,
    dedupeKey: `clause:${to || 'generic'}`,
    kind: 'clause',
    title: functionDescriptor
      ? `${functionDescriptor.name} clause`
      : `Clause to ${to ? shortAddress(to) : 'any address'}`,
    subtitle: to || 'No target address was available on this clause.',
    occurrenceCount: 1,
    addresses: to ? [to] : [],
    candidate,
    decoded: {
      origin: candidate.meta.txOrigin,
      to: candidate.event.to ?? '',
      value: candidate.event.value ?? '',
      data: candidate.event.data ?? '',
      clauseIndex: candidate.meta.clauseIndex ?? 0,
      ...(functionDescriptor ? { functionSignature: functionDescriptor.signature } : {}),
      ...decodedArguments
    },
    ...(functionDescriptor ? { functionDescriptor } : {}),
    selectionStatus: 'ready'
  };
}

function createEventTrigger(
  candidate: Extract<Candidate, { kind: 'event' }>,
  decoderBundle: ParsedDecoderBundle
): AnalyzedTriggerOption {
  const address = candidate.event.address.toLowerCase();
  const topic0 = String(candidate.event.topics[0] ?? '').toLowerCase();
  const eventDescriptor = decoderBundle.eventDescriptorsByTopic.get(topic0);
  const decoded = eventDescriptor?.fragment
    ? decodeEventParameters(candidate.event.topics, candidate.event.data, eventDescriptor.fragment)
    : {};

  const selectionMessage = eventDescriptor?.fragment
    ? undefined
    : eventDescriptor
      ? `Upload the ABI JSON that defines ${eventDescriptor.name}, because the available signature data still does not include a full event ABI fragment.`
      : 'Upload the ABI JSON that defines this event, because the public signature lookup could not restore a full ABI fragment for this topic yet.';

  return {
    id: `event:${topic0}:${address}`,
    dedupeKey: `event:${topic0}:${address}`,
    kind: 'event',
    title: eventDescriptor
      ? `${eventDescriptor.name} event`
      : `Unknown event ${topic0.slice(0, 10)}`,
    subtitle: `Emitter ${address}`,
    occurrenceCount: 1,
    addresses: [address],
    candidate,
    decoded: {
      address: candidate.event.address,
      topic0,
      ...decoded
    },
    selectionStatus: eventDescriptor?.fragment ? 'ready' : 'preview-only',
    ...(eventDescriptor ? { eventDescriptor } : {}),
    ...(selectionMessage ? { selectionMessage } : {})
  };
}

function resolveFunctionDescriptor(
  data: string,
  decoderBundle: ParsedDecoderBundle
): FunctionDescriptor | undefined {
  if (!data.startsWith('0x') || data.length < 10) {
    return undefined;
  }

  return decoderBundle.functionDescriptorsBySelector.get(data.slice(0, 10).toLowerCase());
}

function decodeFunctionArguments(
  data: string,
  descriptor: FunctionDescriptor | undefined
): Record<string, unknown> {
  if (!descriptor || !data.startsWith('0x') || data.length <= 10) {
    return {};
  }

  try {
    const decodedValues = Web3EthAbi.decodeParameters(
      descriptor.fragment.inputs as Parameters<typeof Web3EthAbi.decodeParameters>[0],
      `0x${data.slice(10)}`
    ) as Record<string, unknown>;

    return mapDecodedValues(descriptor.fragment.inputs, decodedValues);
  } catch {
    return {};
  }
}

function decodeEventParameters(
  topics: string[],
  data: string,
  fragment: EventDescriptor['fragment']
): Record<string, unknown> {
  if (!fragment) {
    return {};
  }

  const nonIndexedInputs = fragment.inputs.filter((input) => input.indexed !== true);
  const nonIndexedData = nonIndexedInputs.length > 0
    ? (Web3EthAbi.decodeParameters(
        nonIndexedInputs as Parameters<typeof Web3EthAbi.decodeParameters>[0],
        data
      ) as Record<string, unknown>)
    : {};
  let indexedInputIndex = 0;
  let nonIndexedInputIndex = 0;
  const decoded: Record<string, unknown> = {};

  fragment.inputs.forEach((input, index) => {
    const key = input.name || `arg${index + 1}`;

    if (input.indexed === true) {
      decoded[key] = normalizeDecodedValue(
        Web3EthAbi.decodeParameter(input.type, topics[indexedInputIndex + 1] ?? '0x')
      );
      indexedInputIndex += 1;
      return;
    }

    decoded[key] = normalizeDecodedValue(nonIndexedData[String(nonIndexedInputIndex)]);
    nonIndexedInputIndex += 1;
  });

  return decoded;
}

function mapDecodedValues(
  inputs: AbiInput[],
  decodedValues: Record<string, unknown>
): Record<string, unknown> {
  const mappedValues: Record<string, unknown> = {};

  inputs.forEach((input, index) => {
    mappedValues[input.name || `arg${index + 1}`] = normalizeDecodedValue(
      decodedValues[String(index)]
    );
  });

  return mappedValues;
}

function normalizeDecodedValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeDecodedValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (current, [key, entry]) => {
        current[key] = normalizeDecodedValue(entry);
        return current;
      },
      {}
    );
  }

  return value;
}

function shortAddress(address: string): string {
  if (address.length < 12) {
    return address;
  }

  return `${address.slice(0, 8)}…${address.slice(-4)}`;
}
