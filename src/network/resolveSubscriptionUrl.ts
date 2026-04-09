import * as sdkNetwork from '@vechain/sdk-network';

type UrlFactory = (nodeUrl: string) => string;

function isUrlFactory(value: unknown): value is UrlFactory {
  return typeof value === 'function';
}

export function resolveBlockSubscriptionUrl(nodeUrl: string): string {
  const moduleRecord = sdkNetwork as unknown as Record<string, unknown>;
  const directFactories = [
    moduleRecord.getBlockSubscriptionUrl,
    moduleRecord.getBlocksSubscriptionUrl
  ];

  for (const candidate of directFactories) {
    if (!isUrlFactory(candidate)) {
      continue;
    }

    return candidate(nodeUrl);
  }

  return `${nodeUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/subscriptions/block`;
}
