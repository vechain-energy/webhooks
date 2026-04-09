import type { AnalyzedTriggerOption, HeaderEditorField, WebhookEditorState } from './types.js';

export function createWebhookEditorState(trigger: AnalyzedTriggerOption): WebhookEditorState {
  const id = createDefaultWebhookId(trigger);

  return {
    id,
    enabled: true,
    description: '',
    addresses: [...trigger.addresses],
    requestMethod: 'POST',
    requestUrl: `https://example.com/webhooks/${id}`,
    requestContentType: 'application/json',
    headers: [],
    requestBody: createDefaultRequestBody(trigger),
    signingEnabled: false,
    signingSecretEnv: 'WEBHOOK_SIGNATURE_SECRET',
    signingHeader: ''
  };
}

export function createEmptyHeaderField(): HeaderEditorField {
  return {
    id: createEditorId(),
    key: '',
    value: ''
  };
}

function createDefaultWebhookId(trigger: AnalyzedTriggerOption): string {
  const base = [
    trigger.kind,
    trigger.eventDescriptor?.name ?? trigger.functionDescriptor?.name ?? '',
    trigger.addresses[0] ?? ''
  ]
    .filter(Boolean)
    .join('-');

  return slugify(base || trigger.id);
}

function createDefaultRequestBody(trigger: AnalyzedTriggerOption): string {
  switch (trigger.kind) {
    case 'transaction':
      return JSON.stringify(
        {
          webhookId: '{{webhook.id}}',
          network: '{{network.name}}',
          origin: '{{decoded.origin}}',
          gas: '{{decoded.gas}}',
          gasUsed: '{{decoded.gasUsed}}',
          reverted: '{{decoded.reverted}}',
          txId: '{{meta.txID}}'
        },
        null,
        2
      );
    case 'transfer':
      return JSON.stringify(
        {
          webhookId: '{{webhook.id}}',
          network: '{{network.name}}',
          from: '{{decoded.from}}',
          to: '{{decoded.to}}',
          amount: '{{decoded.amount}}',
          txId: '{{meta.txID}}'
        },
        null,
        2
      );
    case 'clause':
      return JSON.stringify(
        {
          webhookId: '{{webhook.id}}',
          network: '{{network.name}}',
          origin: '{{decoded.origin}}',
          to: '{{decoded.to}}',
          value: '{{decoded.value}}',
          data: '{{decoded.data}}',
          clauseIndex: '{{decoded.clauseIndex}}',
          txId: '{{meta.txID}}'
        },
        null,
        2
      );
    case 'event':
      return JSON.stringify(
        {
          webhookId: '{{webhook.id}}',
          network: '{{network.name}}',
          address: '{{event.address}}',
          txId: '{{meta.txID}}',
          clauseIndex: '{{meta.clauseIndex}}',
          eventIndex: '{{meta.eventIndex}}',
          ...Object.keys(trigger.decoded)
            .filter((key) => !['address', 'topic0'].includes(key))
            .reduce<Record<string, string>>((current, key) => {
              current[key] = `{{decoded.${key}}}`;
              return current;
            }, {})
        },
        null,
        2
      );
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64) || 'generated-webhook';
}

function createEditorId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `header-${Date.now()}`;
}
