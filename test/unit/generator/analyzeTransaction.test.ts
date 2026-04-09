import { describe, expect, it } from 'vitest';

import { buildTriggerOptions } from '../../../src/generator/analyzeTransaction.js';
import { parseDecoderSources } from '../../../src/generator/parseDecoderSources.js';
import {
  mainTransactionDetail,
  mainTransactionReceipt,
  signatureListText,
  transferAbiJson
} from '../../fixtures/generatorFixtures.js';

describe('buildTriggerOptions', () => {
  it('dedupes repeated triggers and marks signature-only events as preview-only', () => {
    const decoderBundle = parseDecoderSources([
      {
        id: 'abi',
        name: 'erc20.json',
        content: transferAbiJson
      },
      {
        id: 'signatures',
        name: 'signatures.txt',
        content: signatureListText
      }
    ]);
    const triggers = buildTriggerOptions({
      decoderBundle,
      receipt: mainTransactionReceipt,
      transaction: mainTransactionDetail
    });
    const clauseTrigger = triggers.find((trigger) => trigger.kind === 'clause');
    const transferTrigger = triggers.find((trigger) => trigger.kind === 'transfer');
    const transferEvent = triggers.find((trigger) => trigger.title === 'Transfer event');
    const pingEvent = triggers.find((trigger) => trigger.title === 'Ping event');

    expect(triggers).toHaveLength(5);
    expect(clauseTrigger?.occurrenceCount).toBe(2);
    expect(transferTrigger?.occurrenceCount).toBe(2);
    expect(transferEvent?.selectionStatus).toBe('ready');
    expect(transferEvent?.decoded.value).toBe('1000');
    expect(pingEvent?.selectionStatus).toBe('preview-only');
    expect(pingEvent?.selectionMessage).toMatch(/upload the ABI JSON/i);
  });
});
