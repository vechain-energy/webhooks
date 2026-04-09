import * as Web3EthAbi from 'web3-eth-abi';

import type { AbiEventFragment, AbiInput } from '../shared/types.js';
import { resolveFetchImplementation, type FetchLike } from './network.js';
import type {
  EventDescriptor,
  ParsedDecoderBundle,
  TransactionEventResponse,
  TransactionReceiptResponse
} from './types.js';

interface SignatureLookupResponseItem {
  text?: string;
  abi?: unknown;
}

export async function lookupEventDescriptors(options: {
  decoderBundle: ParsedDecoderBundle;
  fetchImpl?: FetchLike;
  receipts: TransactionReceiptResponse[];
}): Promise<{ descriptors: EventDescriptor[]; warnings: string[] }> {
  const logsByTopic = collectLogsByTopic(options.receipts);
  const topicsToLookup = [...logsByTopic.keys()].filter((topic0) => {
    const currentDescriptor = options.decoderBundle.eventDescriptorsByTopic.get(topic0);
    return !currentDescriptor?.fragment;
  });

  if (!topicsToLookup.length) {
    return {
      descriptors: [],
      warnings: []
    };
  }

  const fetchImpl = resolveFetchImplementation(options.fetchImpl);
  const results = await Promise.all(
    topicsToLookup.map(async (topic0) =>
      await lookupDescriptorForTopic({
        fetchImpl,
        samples: logsByTopic.get(topic0) ?? [],
        topic0
      })
    )
  );

  return {
    descriptors: results.flatMap((result) => (result.descriptor ? [result.descriptor] : [])),
    warnings: results.flatMap((result) => (result.warning ? [result.warning] : []))
  };
}

function collectLogsByTopic(receipts: TransactionReceiptResponse[]): Map<string, TransactionEventResponse[]> {
  const logsByTopic = new Map<string, TransactionEventResponse[]>();

  for (const receipt of receipts) {
    for (const output of receipt.outputs) {
      for (const event of output.events) {
        const topic0 = String(event.topics[0] ?? '').toLowerCase();

        if (!topic0) {
          continue;
        }

        const currentLogs = logsByTopic.get(topic0) ?? [];
        currentLogs.push(event);
        logsByTopic.set(topic0, currentLogs);
      }
    }
  }

  return logsByTopic;
}

async function lookupDescriptorForTopic(options: {
  fetchImpl: FetchLike;
  samples: TransactionEventResponse[];
  topic0: string;
}): Promise<{ descriptor?: EventDescriptor; warning?: string }> {
  let response: Response;

  try {
    response = await options.fetchImpl(
      `https://sig.api.vechain.energy/${options.topic0}?event=true`
    );
  } catch {
    return {
      warning:
        `The public signature lookup could not be reached for ${shortTopic(options.topic0)}. Upload the contract ABI JSON if you want this event decoded right away.`
    };
  }

  if (!response.ok) {
    return {
      warning:
        `The public signature lookup returned status ${response.status} for ${shortTopic(options.topic0)}. Upload the contract ABI JSON to decode this event immediately.`
    };
  }

  const payload = await response.json() as unknown;
  const descriptors = toLookupEventDescriptors(options.topic0, payload);

  if (!descriptors.length) {
    return {
      warning:
        `The public signature lookup does not know ${shortTopic(options.topic0)} yet. Upload the contract ABI JSON if you want YAML generation for this event.`
    };
  }

  const matchingDescriptor = selectMatchingDescriptor(descriptors, options.samples);

  if (!matchingDescriptor) {
    return {
      warning:
        `The public signature lookup returned ABI candidates for ${shortTopic(options.topic0)}, but none matched the log shape. Upload the contract ABI JSON so the event can be decoded accurately.`
    };
  }

  return {
    descriptor: matchingDescriptor
  };
}

function toLookupEventDescriptors(topic0: string, payload: unknown): EventDescriptor[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const descriptorsByFingerprint = new Map<string, EventDescriptor>();

  for (const item of payload) {
    const descriptor = toLookupEventDescriptor(topic0, item);

    if (!descriptor) {
      continue;
    }

    descriptorsByFingerprint.set(createFragmentFingerprint(descriptor.fragment), descriptor);
  }

  return [...descriptorsByFingerprint.values()];
}

function toLookupEventDescriptor(topic0: string, item: unknown): EventDescriptor | undefined {
  if (!item || typeof item !== 'object') {
    return undefined;
  }

  const record = item as SignatureLookupResponseItem;
  const fragment = toAbiEventFragment(record.abi);

  if (!fragment) {
    return undefined;
  }

  return {
    name: fragment.name,
    signature: buildSignature(fragment.name, fragment.inputs),
    topic0,
    source: 'lookup',
    fragment
  };
}

function toAbiEventFragment(value: unknown): AbiEventFragment | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.name !== 'string' || !Array.isArray(record.inputs)) {
    return undefined;
  }

  return {
    ...record,
    name: record.name,
    type: 'event',
    inputs: record.inputs as AbiInput[]
  };
}

function selectMatchingDescriptor(
  descriptors: EventDescriptor[],
  samples: TransactionEventResponse[]
): EventDescriptor | undefined {
  let bestDescriptor: EventDescriptor | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const descriptor of descriptors) {
    if (!descriptor.fragment) {
      continue;
    }

    const score = scoreDescriptorMatch(descriptor.fragment, samples);

    if (score > bestScore) {
      bestDescriptor = descriptor;
      bestScore = score;
    }
  }

  return bestScore >= 0 ? bestDescriptor : undefined;
}

function scoreDescriptorMatch(
  fragment: AbiEventFragment,
  samples: TransactionEventResponse[]
): number {
  if (!samples.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  for (const sample of samples) {
    if (!matchesIndexedTopicCount(fragment, sample)) {
      return Number.NEGATIVE_INFINITY;
    }

    if (!canDecodeLog(fragment, sample)) {
      return Number.NEGATIVE_INFINITY;
    }

    score += 1;
  }

  const namedInputScore = fragment.inputs.reduce<number>(
    (current, input) => current + (input.name && !String(input.name).startsWith('_') ? 0.01 : 0),
    0
  );

  return score + namedInputScore;
}

function matchesIndexedTopicCount(fragment: AbiEventFragment, sample: TransactionEventResponse): boolean {
  const indexedInputCount = fragment.inputs.filter((input) => input.indexed === true).length;
  return indexedInputCount === Math.max(0, sample.topics.length - 1);
}

function canDecodeLog(fragment: AbiEventFragment, sample: TransactionEventResponse): boolean {
  try {
    Web3EthAbi.decodeLog(
      fragment.inputs as Parameters<typeof Web3EthAbi.decodeLog>[0],
      sample.data,
      sample.topics.slice(1)
    );
    return true;
  } catch {
    return false;
  }
}

function createFragmentFingerprint(fragment: AbiEventFragment | undefined): string {
  if (!fragment) {
    return '';
  }

  return JSON.stringify({
    name: fragment.name,
    inputs: fragment.inputs.map((input) => ({
      indexed: input.indexed === true,
      name: input.name ?? '',
      type: input.type
    }))
  });
}

function buildSignature(name: string, inputs: AbiInput[]): string {
  return `${name}(${inputs.map((input) => input.type).join(',')})`;
}

function shortTopic(topic0: string): string {
  return `${topic0.slice(0, 10)}…`;
}
