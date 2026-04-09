import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TriggerList } from '@app/generator/components/TriggerList';
import type { AnalyzedTriggerOption } from '@generator/types';

describe('TriggerList', () => {
  it('renders decoded fields as a readable list and truncates long values', () => {
    const longValue = `0x${'a'.repeat(80)}`;

    render(
      <TriggerList
        onSelect={vi.fn()}
        selectedTriggerId=""
        triggers={[
          createTrigger({
            decoded: {
              payload: longValue,
              sender: '0x00000000000000000000000000000000000000aa'
            }
          })
        ]}
      />
    );

    expect(screen.getByText('payload')).toBeInTheDocument();
    expect(screen.getByText(/^0x[a]{26}…[a]{16}$/)).toBeInTheDocument();
    expect(screen.queryByText(longValue)).not.toBeInTheDocument();
  });
});

function createTrigger(options: {
  decoded: Record<string, unknown>;
}): AnalyzedTriggerOption {
  const meta = {
    blockID: '0xblock',
    blockNumber: 1,
    blockTimestamp: 1,
    txID: '0xtx',
    txOrigin: '0x00000000000000000000000000000000000000aa',
    candidateId: 'transaction:0xtx'
  };

  return {
    id: 'transaction:test',
    dedupeKey: 'transaction:test',
    kind: 'transaction',
    title: 'Transactions from 0x000000…00aa',
    subtitle: 'Origin 0x00000000000000000000000000000000000000aa',
    occurrenceCount: 1,
    addresses: ['0x00000000000000000000000000000000000000aa'],
    candidate: {
      kind: 'transaction',
      event: {
        id: '0xtx',
        origin: '0x00000000000000000000000000000000000000aa',
        clauses: [],
        outputs: [],
        meta
      },
      meta
    },
    decoded: options.decoded,
    selectionStatus: 'ready'
  };
}
