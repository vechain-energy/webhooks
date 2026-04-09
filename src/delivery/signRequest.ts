import { createHmac } from 'node:crypto';

export function createWebhookSignature(options: {
  timestamp: string;
  body: string;
  secret: string;
}): string {
  const { body, secret, timestamp } = options;

  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}
