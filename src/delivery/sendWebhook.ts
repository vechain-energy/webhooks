import { setTimeout as delay } from 'node:timers/promises';

import type { Logger } from 'pino';

import { DeliveryError } from '../shared/errors.js';
import type {
  DeliveryResult,
  RenderedRequest,
  RuntimeConfig
} from '../shared/types.js';

export async function sendWebhook(options: {
  request: RenderedRequest;
  runtimeConfig: RuntimeConfig;
  logger: Logger;
}): Promise<DeliveryResult> {
  const { logger, request, runtimeConfig } = options;
  const {
    initialBackoffMs,
    maxAttempts,
    maxBackoffMs,
    requestTimeoutMs
  } = runtimeConfig.delivery;

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    request.headers['x-webhook-attempt'] = String(attempt);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.method !== 'GET' && request.body !== undefined
          ? { body: request.body }
          : {}),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const body = await response.text();
      if (!response.ok) {
        lastError = `Webhook returned status ${response.status}. Inspect the receiver response body to correct the integration.`;
        logger.warn(
          {
            attempt,
            statusCode: response.status,
            body,
            url: request.url
          },
          'Webhook delivery failed'
        );
        await backoff(attempt);
        continue;
      }

      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body
      };
    } catch (error) {
      clearTimeout(timeoutId);
      lastError =
        error instanceof Error
          ? error.message
          : 'Webhook request failed for an unknown reason.';
      logger.warn(
        {
          attempt,
          error: lastError,
          url: request.url
        },
        'Webhook delivery request failed'
      );
      await backoff(attempt);
    }
  }

  throw new DeliveryError(
    lastError ??
      'Webhook delivery failed. Check the receiver endpoint, connectivity, and delivery settings.'
  );

  async function backoff(attempt: number): Promise<void> {
    if (attempt >= maxAttempts) {
      return;
    }

    const nextDelay = Math.min(initialBackoffMs * (2 ** (attempt - 1)), maxBackoffMs);
    await delay(nextDelay);
  }
}
