import type {
  NetworkName
} from '../shared/types.js';
import type {
  NetworkProbeResult,
  NormalizedTransactionInput,
  TransactionDetailResponse,
  TransactionReceiptResponse
} from './types.js';

export const networkNodeUrls: Record<NetworkName, string> = {
  main: 'https://mainnet.vechain.org',
  test: 'https://testnet.vechain.org'
};

export type FetchLike = typeof fetch;
export type NetworkSelection = NetworkName | 'auto';

export function normalizeTransactionInput(rawValue: string): NormalizedTransactionInput {
  const raw = rawValue.trim();
  if (!raw) {
    throw new Error(
      'Enter a VeChain transaction id or paste a transaction link so the generator knows what to inspect.'
    );
  }

  const hashMatch = raw.match(/(?:0x)?([a-fA-F0-9]{64})/);
  if (!hashMatch?.[1]) {
    throw new Error(
      'Enter a 66-character VeChain transaction id, or paste a transaction URL that contains one, so the generator can load the receipt.'
    );
  }

  const normalizedInput: NormalizedTransactionInput = {
    raw,
    txId: `0x${hashMatch[1]}`.toLowerCase(),
    source: raw.includes('://') ? 'url' : 'tx-id'
  };

  const networkHint = resolveNetworkHint(raw);
  if (networkHint) {
    normalizedInput.networkHint = networkHint;
  }

  return normalizedInput;
}

export async function probeTransactionNetworks(options: {
  normalizedInput: NormalizedTransactionInput;
  preferredNetwork?: NetworkName;
  fetchImpl?: FetchLike;
}): Promise<NetworkProbeResult[]> {
  const { normalizedInput, preferredNetwork } = options;
  const fetchImpl = resolveFetchImplementation(options.fetchImpl);
  const orderedNetworks = orderNetworks(preferredNetwork ?? normalizedInput.networkHint);

  return await Promise.all(
    orderedNetworks.map(async (network) =>
      await probeSingleNetwork({
        txId: normalizedInput.txId,
        network,
        fetchImpl
      })
    )
  );
}

export function selectProbeResult(options: {
  networkHint?: NetworkName;
  requestedNetwork: NetworkSelection;
  results: NetworkProbeResult[];
}): NetworkProbeResult | undefined {
  const { requestedNetwork, results } = options;
  const orderedNetworks = orderNetworks(
    requestedNetwork === 'auto' ? options.networkHint : requestedNetwork
  );

  if (requestedNetwork !== 'auto') {
    return results.find((result) => result.network === requestedNetwork);
  }

  const orderedResults = orderedNetworks
    .map((network) => results.find((result) => result.network === network))
    .filter((result): result is NetworkProbeResult => result !== undefined);

  return (
    orderedResults.find((result) => result.status === 'confirmed') ??
    orderedResults.find((result) => result.status === 'pending') ??
    orderedResults[0]
  );
}

function resolveNetworkHint(raw: string): NetworkName | undefined {
  const normalized = raw.toLowerCase();

  if (normalized.includes('testnet') || normalized.includes('node-testnet')) {
    return 'test';
  }

  if (normalized.includes('mainnet') || normalized.includes('mainnet.vechain.org')) {
    return 'main';
  }

  return undefined;
}

function orderNetworks(preferredNetwork?: NetworkName): NetworkName[] {
  if (!preferredNetwork) {
    return ['main', 'test'];
  }

  return preferredNetwork === 'main' ? ['main', 'test'] : ['test', 'main'];
}

async function probeSingleNetwork(options: {
  txId: string;
  network: NetworkName;
  fetchImpl: FetchLike;
}): Promise<NetworkProbeResult> {
  const { fetchImpl, network, txId } = options;
  const nodeUrl = networkNodeUrls[network];

  try {
    const [transaction, receipt] = await Promise.all([
      fetchJson<TransactionDetailResponse | null>({
        allowNotFound: true,
        fetchImpl,
        label: 'transaction',
        network,
        url: `${nodeUrl}/transactions/${txId}?pending=true`
      }),
      fetchJson<TransactionReceiptResponse | null>({
        allowNotFound: true,
        fetchImpl,
        label: 'transaction receipt',
        network,
        url: `${nodeUrl}/transactions/${txId}/receipt`
      })
    ]);

    if (!transaction) {
      return {
        network,
        nodeUrl,
        status: 'not-found',
        message:
          `The transaction was not found on ${network}net. Check the id or switch networks if you expected a different chain.`,
        transaction: null,
        receipt: null
      };
    }

    if (!receipt) {
      return {
        network,
        nodeUrl,
        status: 'pending',
        message:
          `The transaction exists on ${network}net, but the receipt is not available yet. Wait for the transaction to finalize, then analyze it again.`,
        transaction,
        receipt: null
      };
    }

    return {
      network,
      nodeUrl,
      status: 'confirmed',
      message: `Loaded the confirmed transaction and receipt from ${network}net.`,
      transaction,
      receipt
    };
  } catch (error) {
    return {
      network,
      nodeUrl,
      status: 'error',
      message: error instanceof Error
        ? error.message
        : `The ${network}net node could not be reached. Retry the request or try the other network.`,
      transaction: null,
      receipt: null
    };
  }
}

async function fetchJson<T>(options: {
  allowNotFound?: boolean;
  fetchImpl: FetchLike;
  label: string;
  network: NetworkName;
  url: string;
}): Promise<T> {
  const response = await options.fetchImpl(options.url);

  if (options.allowNotFound && response.status === 404) {
    return null as T;
  }

  if (!response.ok) {
    throw new Error(
      `The ${options.network}net node returned status ${response.status} while loading the ${options.label}. Retry the request, or switch networks if the transaction belongs elsewhere.`
    );
  }

  return await response.json() as T;
}

export function resolveFetchImplementation(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) {
    return ((input: string | URL | Request, init?: Parameters<FetchLike>[1]) =>
      fetchImpl.call(globalThis, input, init)) as FetchLike;
  }

  return ((input: string | URL | Request, init?: Parameters<FetchLike>[1]) =>
    globalThis.fetch(input, init)) as FetchLike;
}
