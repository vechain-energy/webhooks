export type NetworkName = 'main' | 'test';
export type MatchKind = 'event' | 'transfer' | 'transaction' | 'clause';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'empty'
  | 'notEmpty'
  | 'in'
  | 'notIn';

export interface RuntimeConfig {
  version: 1;
  network: NetworkName;
  nodeUrl: string;
  server: {
    port: number;
  };
  processing: {
    confirmations: number;
    replayWindowBlocks: number;
  };
  delivery: {
    requestTimeoutMs: number;
    maxAttempts: number;
    initialBackoffMs: number;
    maxBackoffMs: number;
    defaultHeaders: Record<string, string>;
    signing: {
      defaultEnabled: boolean;
      header: string;
    };
  };
  logLevel: LogLevel;
}

export interface WebhookConfig {
  version: 1;
  id: string;
  enabled: boolean;
  description?: string;
  match: {
    kind: MatchKind;
    addresses?: string[];
    event?: {
      name: string;
      abi: {
        inline?: unknown;
        file?: string;
      };
    };
  };
  decode?: {
    fields?: Record<string, DecodeFieldConfig>;
  };
  filters?: WebhookFilter[];
  request: {
    method: HttpMethod;
    url: string;
    headers?: Record<string, string>;
    contentType?: string;
    body?: string;
    signing?: {
      enabled: boolean;
      secretEnv: string;
      header?: string;
    };
  };
}

export interface DecodeFieldConfig {
  format?: 'ether';
  bytes?: 'utf8';
}

export interface WebhookFilter {
  field: string;
  op: FilterOperator;
  value?: string;
  values?: string[];
}

export interface AbiInput {
  [key: string]: unknown;
  name?: string;
  type: string;
  indexed?: boolean;
}

export interface AbiEventFragment {
  [key: string]: unknown;
  type: 'event';
  anonymous?: boolean;
  name: string;
  inputs: AbiInput[];
}

export interface CompiledWebhook {
  sourcePath: string;
  config: WebhookConfig;
  normalizedAddresses: string[];
  eventMatcher?: {
    fragment: AbiEventFragment;
    topic0: string;
  };
}

export interface CompiledProject {
  rootDirectory: string;
  runtimeConfigPath: string;
  runtimeConfig: RuntimeConfig;
  webhooks: CompiledWebhook[];
}

export interface BlockMeta {
  blockID: string;
  blockNumber: number;
  blockTimestamp: number;
  txID: string;
  txOrigin: string;
  candidateId: string;
  clauseIndex?: number | undefined;
  eventIndex?: number | undefined;
  transferIndex?: number | undefined;
  clause?: ThorClause | undefined;
}

export interface ThorClause {
  to?: string | null;
  value?: string;
  data?: string;
  [key: string]: unknown;
}

export interface ThorEvent {
  address: string;
  topics: string[];
  data: string;
  meta: BlockMeta;
  [key: string]: unknown;
}

export interface ThorTransfer {
  sender: string;
  recipient: string;
  amount: string;
  meta: BlockMeta;
  [key: string]: unknown;
}

export interface ThorTransaction {
  id: string;
  origin: string;
  delegator?: string | null;
  gasPayer?: string | null;
  blockRef?: string;
  nonce?: string | number;
  dependsOn?: string | null;
  chainTag?: number;
  expiration?: number;
  gasPriceCoef?: number;
  gas?: number;
  gasUsed?: number;
  size?: number;
  reverted?: boolean;
  paid?: string;
  reward?: string;
  clauses: ThorClause[];
  outputs: Array<{
    events: Omit<ThorEvent, 'meta'>[];
    transfers: Omit<ThorTransfer, 'meta'>[];
  }>;
  meta: BlockMeta;
  [key: string]: unknown;
}

export interface ClauseCandidate {
  kind: 'clause';
  event: ThorClause & { meta: BlockMeta };
  meta: BlockMeta;
}

export interface EventCandidate {
  kind: 'event';
  event: ThorEvent;
  meta: BlockMeta;
}

export interface TransferCandidate {
  kind: 'transfer';
  event: ThorTransfer;
  meta: BlockMeta;
}

export interface TransactionCandidate {
  kind: 'transaction';
  event: ThorTransaction;
  meta: BlockMeta;
}

export type Candidate =
  | ClauseCandidate
  | EventCandidate
  | TransferCandidate
  | TransactionCandidate;

export interface RenderContext {
  decoded: Record<string, unknown>;
  event: Record<string, unknown>;
  meta: Record<string, unknown>;
  network: {
    name: NetworkName;
  };
  webhook: {
    id: string;
  };
}

export interface RenderedRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string | undefined;
  deliveryId: string;
}

export interface DeliveryResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface WebhookDelivery {
  webhookId: string;
  candidateId: string;
  request: RenderedRequest;
  result?: DeliveryResult;
  error?: string;
}

export interface MatcherIndex {
  eventsByTopic: Map<string, AddressMatcherBucket>;
  transfers: AddressMatcherBucket;
  transactions: AddressMatcherBucket;
  clauses: AddressMatcherBucket;
  byId: Map<string, CompiledWebhook>;
}

export interface AddressMatcherBucket {
  generic: CompiledWebhook[];
  byAddress: Map<string, CompiledWebhook[]>;
}

export interface ProcessorState {
  ready: boolean;
  connected: boolean;
  loadedWebhooks: number;
  lastProcessedBlockNumber?: number | undefined;
  lastProcessedBlockId?: string | undefined;
  lastObservedBlockNumber?: number | undefined;
  lastObservedBlockId?: string | undefined;
  lastError?: string | undefined;
  startedAt: string;
}

export interface BlockNotification {
  number: number;
}

export interface ThorBlock {
  number: number;
  id: string;
  timestamp: number;
  transactions: ThorTransaction[];
  [key: string]: unknown;
}
