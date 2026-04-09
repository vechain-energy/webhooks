import { describe, expect, it } from 'vitest';

import { parseDecoderSources } from '../../../src/generator/parseDecoderSources.js';
import {
  pingEventTopic,
  signatureListText,
  transferAbiJson,
  transferEventTopic,
  transferFunctionSelector
} from '../../fixtures/generatorFixtures.js';

describe('parseDecoderSources', () => {
  it('parses ABI JSON and signature lists into decoder descriptors', () => {
    const bundle = parseDecoderSources([
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

    expect(bundle.warnings).toEqual([]);
    expect(bundle.eventDescriptorsByTopic.get(transferEventTopic)?.source).toBe('abi');
    expect(bundle.eventDescriptorsByTopic.get(pingEventTopic)?.source).toBe('signature');
    expect(bundle.functionDescriptorsBySelector.get(transferFunctionSelector)?.name).toBe(
      'transfer'
    );
  });

  it('returns instructive warnings for unusable files', () => {
    const bundle = parseDecoderSources([
      {
        id: 'broken',
        name: 'broken.json',
        content: '{"broken":'
      }
    ]);

    expect(bundle.warnings[0]).toMatch(/could not be parsed as JSON/i);
  });
});
