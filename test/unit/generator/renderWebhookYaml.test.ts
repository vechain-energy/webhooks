import { describe, expect, it } from 'vitest';

import { buildTriggerOptions } from '../../../src/generator/analyzeTransaction.js';
import { createWebhookEditorState } from '../../../src/generator/createWebhookEditorState.js';
import { parseDecoderSources } from '../../../src/generator/parseDecoderSources.js';
import { renderWebhookYaml } from '../../../src/generator/renderWebhookYaml.js';
import {
  mainTransactionDetail,
  mainTransactionReceipt,
  signatureListText,
  transferAbiJson
} from '../../fixtures/generatorFixtures.js';

describe('renderWebhookYaml', () => {
  it('renders a self-contained event webhook file with inline ABI', () => {
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
    const trigger = buildTriggerOptions({
      decoderBundle,
      receipt: mainTransactionReceipt,
      transaction: mainTransactionDetail
    }).find((entry) => entry.title === 'Transfer event');

    expect(trigger).toBeDefined();

    const editorState = createWebhookEditorState(trigger!);
    editorState.requestUrl = 'https://hooks.example.com/events';
    const result = renderWebhookYaml({
      editorState,
      trigger: trigger!
    });

    expect(result.error).toBeUndefined();
    expect(result.yaml).toContain('kind: event');
    expect(result.yaml).toContain('name: Transfer');
    expect(result.yaml).toContain('inline:');
    expect(result.yaml).toContain('url: https://hooks.example.com/events');
  });

  it('blocks event YAML generation when only a raw signature is available', () => {
    const decoderBundle = parseDecoderSources([
      {
        id: 'signatures',
        name: 'signatures.txt',
        content: signatureListText
      }
    ]);
    const trigger = buildTriggerOptions({
      decoderBundle,
      receipt: mainTransactionReceipt,
      transaction: mainTransactionDetail
    }).find((entry) => entry.title === 'Ping event');

    expect(trigger).toBeDefined();

    const editorState = createWebhookEditorState(trigger!);
    const result = renderWebhookYaml({
      editorState,
      trigger: trigger!
    });

    expect(result.yaml).toBeUndefined();
    expect(result.error).toMatch(/upload the ABI JSON/i);
  });
});
