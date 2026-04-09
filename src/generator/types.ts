import type {
  AbiEventFragment,
  AbiInput,
  Candidate,
  HttpMethod,
  MatchKind,
  NetworkName
} from '../shared/types.js';

export interface AbiFunctionFragment {
  [key: string]: unknown;
  type?: 'function';
  name: string;
  inputs: AbiInput[];
  outputs?: AbiInput[];
  stateMutability?: string;
}

export interface NormalizedTransactionInput {
  raw: string;
  txId: string;
  source: 'tx-id' | 'url';
  networkHint?: NetworkName;
}

export interface DecoderSource {
  id: string;
  name: string;
  content: string;
}

export interface EventDescriptor {
  name: string;
  signature: string;
  topic0: string;
  source: 'abi' | 'signature' | 'lookup';
  fragment?: AbiEventFragment;
}

export interface FunctionDescriptor {
  name: string;
  signature: string;
  selector: string;
  source: 'abi' | 'signature';
  fragment: AbiFunctionFragment;
}

export interface ParsedDecoderBundle {
  sources: DecoderSource[];
  cacheKey: string;
  warnings: string[];
  eventDescriptorsByTopic: Map<string, EventDescriptor>;
  functionDescriptorsBySelector: Map<string, FunctionDescriptor>;
}

export interface TransactionClauseResponse {
  to?: string | null;
  value?: string;
  data?: string;
}

export interface TransactionDetailResponse {
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
  size?: number;
  type?: number;
  clauses: TransactionClauseResponse[];
  meta: {
    blockID: string;
    blockNumber: number;
    blockTimestamp: number;
  };
}

export interface TransactionEventResponse {
  address: string;
  topics: string[];
  data: string;
}

export interface TransactionTransferResponse {
  sender: string;
  recipient: string;
  amount: string;
}

export interface TransactionOutputResponse {
  contractAddress?: string | null;
  events: TransactionEventResponse[];
  transfers: TransactionTransferResponse[];
}

export interface TransactionReceiptResponse {
  gasUsed: number;
  gasPayer: string;
  paid: string;
  reward: string;
  reverted: boolean;
  outputs: TransactionOutputResponse[];
  meta: {
    blockID: string;
    blockNumber: number;
    blockTimestamp: number;
    txID: string;
    txOrigin: string;
  };
}

export interface NetworkProbeResult {
  network: NetworkName;
  nodeUrl: string;
  status: 'confirmed' | 'pending' | 'not-found' | 'error';
  message: string;
  transaction: TransactionDetailResponse | null;
  receipt: TransactionReceiptResponse | null;
}

export interface AnalyzedTriggerOption {
  id: string;
  dedupeKey: string;
  kind: MatchKind;
  title: string;
  subtitle: string;
  occurrenceCount: number;
  addresses: string[];
  candidate: Candidate;
  decoded: Record<string, unknown>;
  eventDescriptor?: EventDescriptor;
  functionDescriptor?: FunctionDescriptor;
  selectionStatus: 'ready' | 'preview-only';
  selectionMessage?: string;
}

export interface HeaderEditorField {
  id: string;
  key: string;
  value: string;
}

export interface WebhookEditorState {
  id: string;
  enabled: boolean;
  description: string;
  addresses: string[];
  requestMethod: HttpMethod;
  requestUrl: string;
  requestContentType: string;
  headers: HeaderEditorField[];
  requestBody: string;
  signingEnabled: boolean;
  signingSecretEnv: string;
  signingHeader: string;
}

export interface RenderWebhookYamlResult {
  yaml?: string;
  error?: string;
}
