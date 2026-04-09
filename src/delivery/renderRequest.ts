import Handlebars from 'handlebars';

import { sha256 } from '../shared/hash.js';
import type {
  CompiledWebhook,
  RenderContext,
  RenderedRequest,
  RuntimeConfig
} from '../shared/types.js';
import { createWebhookSignature } from './signRequest.js';

const templateEngine = Handlebars.create();

function renderTemplate(template: string, context: RenderContext): string {
  return templateEngine.compile(template, {
    noEscape: true,
    strict: true
  })(context);
}

export function renderRequest(options: {
  webhook: CompiledWebhook;
  context: RenderContext;
  runtimeConfig: RuntimeConfig;
  env: Readonly<Record<string, string | undefined>>;
}): RenderedRequest {
  const { context, env, runtimeConfig, webhook } = options;
  const deliveryId = sha256(`${webhook.config.id}:${String(context.meta.candidateId ?? '')}`);
  const timestamp = new Date().toISOString();

  const method = webhook.config.request.method;
  const renderedUrl = renderTemplate(webhook.config.request.url, context);
  const renderedBody = webhook.config.request.body
    ? renderTemplate(webhook.config.request.body, context)
    : undefined;
  const headers = renderHeaders({
    runtimeConfig,
    webhook,
    context,
    timestamp
  });

  const signingConfig = webhook.config.request.signing;
  if (signingConfig?.enabled ?? runtimeConfig.delivery.signing.defaultEnabled) {
    const secret = env[signingConfig?.secretEnv ?? ''];
    if (!secret) {
      throw new Error(
        `Webhook "${webhook.config.id}" requires a signing secret. Set ${signingConfig?.secretEnv} before starting the processor.`
      );
    }

    const signatureHeader =
      signingConfig?.header ?? runtimeConfig.delivery.signing.header;
    headers[signatureHeader] = createWebhookSignature({
      timestamp,
      body: renderedBody ?? '',
      secret
    });
  }

  return {
    method,
    url: renderedUrl,
    headers,
    deliveryId,
    ...(renderedBody !== undefined ? { body: renderedBody } : {})
  };
}

function renderHeaders(options: {
  runtimeConfig: RuntimeConfig;
  webhook: CompiledWebhook;
  context: RenderContext;
  timestamp: string;
}): Record<string, string> {
  const { context, runtimeConfig, timestamp, webhook } = options;
  const configuredHeaders = webhook.config.request.headers ?? {};
  const headers: Record<string, string> = {
    ...runtimeConfig.delivery.defaultHeaders
  };

  for (const [key, value] of Object.entries(configuredHeaders)) {
    headers[key] = renderTemplate(value, context);
  }

  const contentType =
    webhook.config.request.contentType ??
    (webhook.config.request.body ? 'application/json' : undefined);
  if (contentType) {
    headers['content-type'] = contentType;
  }

  headers['x-webhook-id'] = webhook.config.id;
  headers['x-webhook-delivery-id'] = sha256(
    `${webhook.config.id}:${String(context.meta.candidateId ?? '')}`
  );
  headers['x-webhook-attempt'] = '1';
  headers['x-webhook-timestamp'] = timestamp;

  return headers;
}
