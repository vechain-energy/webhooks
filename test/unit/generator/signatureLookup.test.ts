import { describe, expect, it, vi } from 'vitest';

import { buildTriggerOptions } from '../../../src/generator/analyzeTransaction.js';
import { mergeEventDescriptorsByTopic, parseDecoderSources } from '../../../src/generator/parseDecoderSources.js';
import { lookupEventDescriptors } from '../../../src/generator/signatureLookup.js';
import {
  mainTransactionDetail,
  mainTransactionReceipt,
  transferEventTopic
} from '../../fixtures/generatorFixtures.js';

describe('signature lookup', () => {
  it('restores an event ABI and picks the variant that matches the log shape', async () => {
    const decoderBundle = parseDecoderSources([]);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.includes(transferEventTopic)) {
        return createJsonResponse([
          {
            text: 'Transfer(address,address,uint256)',
            abi: {
              name: 'Transfer',
              inputs: [
                { indexed: true, name: 'from', type: 'address' },
                { indexed: true, name: 'to', type: 'address' },
                { indexed: false, name: 'value', type: 'uint256' }
              ],
              type: 'event'
            }
          },
          {
            text: 'Transfer(address,address,uint256)',
            abi: {
              name: 'Transfer',
              inputs: [
                { indexed: true, name: 'from', type: 'address' },
                { indexed: true, name: 'to', type: 'address' },
                { indexed: true, name: 'tokenId', type: 'uint256' }
              ],
              type: 'event'
            }
          }
        ]);
      }

      return createJsonResponse([]);
    }) as typeof fetch;
    const lookupResult = await lookupEventDescriptors({
      decoderBundle,
      fetchImpl: fetchMock,
      receipts: [mainTransactionReceipt]
    });
    const mergedDecoderBundle = {
      ...decoderBundle,
      eventDescriptorsByTopic: mergeEventDescriptorsByTopic(
        decoderBundle.eventDescriptorsByTopic,
        lookupResult.descriptors
      )
    };
    const triggers = buildTriggerOptions({
      decoderBundle: mergedDecoderBundle,
      receipt: mainTransactionReceipt,
      transaction: mainTransactionDetail
    });
    const transferEvent = triggers.find((trigger) => trigger.title === 'Transfer event');

    expect(lookupResult.warnings).toHaveLength(1);
    expect(transferEvent?.selectionStatus).toBe('ready');
    expect(transferEvent?.decoded.value).toBe('1000');
    expect(transferEvent?.decoded.tokenId).toBeUndefined();
  });
});

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });
}
