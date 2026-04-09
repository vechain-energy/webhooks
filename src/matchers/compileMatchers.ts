import type {
  AddressMatcherBucket,
  Candidate,
  CompiledWebhook,
  MatcherIndex
} from '../shared/types.js';

function createBucket(): AddressMatcherBucket {
  return {
    generic: [],
    byAddress: new Map<string, CompiledWebhook[]>()
  };
}

function addToBucket(
  bucket: AddressMatcherBucket,
  webhook: CompiledWebhook,
  addresses: string[]
): void {
  if (!addresses.length) {
    bucket.generic.push(webhook);
    return;
  }

  for (const address of addresses) {
    const current = bucket.byAddress.get(address) ?? [];
    current.push(webhook);
    bucket.byAddress.set(address, current);
  }
}

function collectFromBucket(
  bucket: AddressMatcherBucket,
  addresses: string[]
): CompiledWebhook[] {
  const matches = [...bucket.generic];

  for (const address of addresses) {
    const current = bucket.byAddress.get(address.toLowerCase());
    if (!current?.length) {
      continue;
    }

    matches.push(...current);
  }

  return dedupeWebhooks(matches);
}

function dedupeWebhooks(webhooks: CompiledWebhook[]): CompiledWebhook[] {
  const seen = new Set<string>();
  return webhooks.filter((webhook) => {
    if (seen.has(webhook.config.id)) {
      return false;
    }

    seen.add(webhook.config.id);
    return true;
  });
}

export function compileMatchers(webhooks: CompiledWebhook[]): MatcherIndex {
  const eventsByTopic = new Map<string, AddressMatcherBucket>();
  const transfers = createBucket();
  const transactions = createBucket();
  const clauses = createBucket();
  const byId = new Map<string, CompiledWebhook>();

  for (const webhook of webhooks) {
    byId.set(webhook.config.id, webhook);

    if (!webhook.config.enabled) {
      continue;
    }

    switch (webhook.config.match.kind) {
      case 'event': {
        const topic0 = webhook.eventMatcher?.topic0;
        if (!topic0) {
          break;
        }

        const bucket = eventsByTopic.get(topic0) ?? createBucket();
        addToBucket(bucket, webhook, webhook.normalizedAddresses);
        eventsByTopic.set(topic0, bucket);
        break;
      }
      case 'transfer':
        addToBucket(transfers, webhook, webhook.normalizedAddresses);
        break;
      case 'transaction':
        addToBucket(transactions, webhook, webhook.normalizedAddresses);
        break;
      case 'clause':
        addToBucket(clauses, webhook, webhook.normalizedAddresses);
        break;
    }
  }

  return {
    eventsByTopic,
    transfers,
    transactions,
    clauses,
    byId
  };
}

export function findMatchingWebhooks(
  index: MatcherIndex,
  candidate: Candidate
): CompiledWebhook[] {
  switch (candidate.kind) {
    case 'event': {
      const topic0 = String(candidate.event.topics[0] ?? '').toLowerCase();
      const bucket = index.eventsByTopic.get(topic0);

      if (!bucket) {
        return [];
      }

      return collectFromBucket(bucket, [candidate.event.address]);
    }
    case 'transfer':
      return collectFromBucket(index.transfers, [
        candidate.event.sender,
        candidate.event.recipient
      ]);
    case 'transaction':
      return collectFromBucket(index.transactions, [candidate.event.origin]);
    case 'clause':
      return collectFromBucket(index.clauses, [
        String(candidate.event.to ?? '')
      ]);
  }
}
