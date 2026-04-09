import type {
  BlockMeta,
  Candidate,
  ClauseCandidate,
  EventCandidate,
  ThorBlock,
  ThorClause,
  ThorEvent,
  ThorTransaction,
  ThorTransfer,
  TransactionCandidate,
  TransferCandidate
} from '../shared/types.js';

function createBlockMeta(options: {
  block: ThorBlock;
  transaction: ThorTransaction;
  candidateId: string;
  clauseIndex?: number;
  eventIndex?: number;
  transferIndex?: number;
  clause?: ThorClause;
}): BlockMeta {
  const {
    block,
    candidateId,
    clause,
    clauseIndex,
    eventIndex,
    transaction,
    transferIndex
  } = options;

  return {
    blockID: block.id,
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    txID: transaction.id,
    txOrigin: transaction.origin,
    candidateId,
    ...(clause ? { clause } : {}),
    ...(clauseIndex !== undefined ? { clauseIndex } : {}),
    ...(eventIndex !== undefined ? { eventIndex } : {}),
    ...(transferIndex !== undefined ? { transferIndex } : {})
  };
}

export function deriveCandidates(block: ThorBlock): Candidate[] {
  const candidates: Candidate[] = [];

  for (const transaction of block.transactions) {
    const transactionMeta = createBlockMeta({
      block,
      transaction,
      candidateId: `transaction:${transaction.id}`
    });

    const transactionEvent: ThorTransaction = {
      ...transaction,
      meta: transactionMeta
    };

    const transactionCandidate: TransactionCandidate = {
      kind: 'transaction',
      event: transactionEvent,
      meta: transactionMeta
    };

    candidates.push(transactionCandidate);

    transaction.clauses.forEach((clause, clauseIndex) => {
      const clauseMeta = createBlockMeta({
        block,
        transaction,
        candidateId: `clause:${transaction.id}:${clauseIndex}`,
        clause,
        clauseIndex
      });

      const clauseEvent = {
        ...clause,
        meta: clauseMeta
      };

      const clauseCandidate: ClauseCandidate = {
        kind: 'clause',
        event: clauseEvent,
        meta: clauseMeta
      };

      candidates.push(clauseCandidate);

      const output = transaction.outputs[clauseIndex];
      if (!output) {
        return;
      }

      output.transfers.forEach((transfer, transferIndex) => {
        const transferRecord = transfer as Record<string, unknown>;
        const transferMeta = createBlockMeta({
          block,
          transaction,
          candidateId: `transfer:${transaction.id}:${clauseIndex}:${transferIndex}`,
          clause,
          clauseIndex,
          transferIndex
        });
        const transferEvent: ThorTransfer = {
          sender: String(transferRecord.sender ?? ''),
          recipient: String(transferRecord.recipient ?? ''),
          amount: String(transferRecord.amount ?? '0'),
          ...transfer,
          meta: transferMeta
        };
        const transferCandidate: TransferCandidate = {
          kind: 'transfer',
          event: transferEvent,
          meta: transferMeta
        };
        candidates.push(transferCandidate);
      });

      output.events.forEach((event, eventIndex) => {
        const eventRecordSource = event as Record<string, unknown>;
        const eventMeta = createBlockMeta({
          block,
          transaction,
          candidateId: `event:${transaction.id}:${clauseIndex}:${eventIndex}`,
          clause,
          clauseIndex,
          eventIndex
        });
        const eventRecord: ThorEvent = {
          address: String(eventRecordSource.address ?? ''),
          topics: Array.isArray(eventRecordSource.topics)
            ? (eventRecordSource.topics as string[])
            : [],
          data: String(eventRecordSource.data ?? '0x'),
          ...event,
          meta: eventMeta
        };
        const eventCandidate: EventCandidate = {
          kind: 'event',
          event: eventRecord,
          meta: eventMeta
        };
        candidates.push(eventCandidate);
      });
    });
  }

  return candidates;
}
