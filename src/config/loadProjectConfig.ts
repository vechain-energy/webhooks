import { resolve } from 'node:path';

import { globby } from 'globby';

import { ConfigurationError } from '../shared/errors.js';
import type {
  CompiledProject,
  CompiledWebhook,
  RuntimeConfig,
  WebhookConfig
} from '../shared/types.js';
import { runtimeConfigSchema, webhookConfigSchema } from './schema.js';
import { loadYamlFile } from './loadYaml.js';
import { resolveEventFragment } from './resolveAbi.js';

export async function loadProjectConfig(
  runtimeConfigPath: string
): Promise<CompiledProject> {
  const absoluteRuntimeConfigPath = resolve(runtimeConfigPath);
  const rawRuntimeConfig = await loadYamlFile(absoluteRuntimeConfigPath);
  const parsedRuntimeConfig = runtimeConfigSchema.safeParse(rawRuntimeConfig);

  if (!parsedRuntimeConfig.success) {
    throw new ConfigurationError(
      `Runtime config is invalid. Update ${absoluteRuntimeConfigPath} so it matches the public schema.\n${parsedRuntimeConfig.error.message}`
    );
  }

  const runtimeConfig = parsedRuntimeConfig.data as RuntimeConfig;
  const rootDirectory = resolve(absoluteRuntimeConfigPath, '..', '..');
  const webhookPaths = await globby('webhooks/*.yml', {
    cwd: resolve(rootDirectory, 'config'),
    absolute: true
  });

  if (!webhookPaths.length) {
    throw new ConfigurationError(
      `No webhook YAML files were found. Add one or more files under ${resolve(rootDirectory, 'config', 'webhooks')}.`
    );
  }

  const webhooks = await Promise.all(
    webhookPaths.map(async (path) => loadWebhookConfig(path))
  );

  return {
    rootDirectory,
    runtimeConfigPath: absoluteRuntimeConfigPath,
    runtimeConfig,
    webhooks
  };
}

async function loadWebhookConfig(path: string): Promise<CompiledWebhook> {
  const rawWebhookConfig = await loadYamlFile(path);
  const parsedWebhookConfig = webhookConfigSchema.safeParse(rawWebhookConfig);

  if (!parsedWebhookConfig.success) {
    throw new ConfigurationError(
      `Webhook config is invalid. Update ${path} so it matches the schema.\n${parsedWebhookConfig.error.message}`
    );
  }

  const webhook = parsedWebhookConfig.data as WebhookConfig;
  const normalizedAddresses = (webhook.match.addresses ?? []).map((address) =>
    address.toLowerCase()
  );

  if (webhook.match.kind !== 'event' || !webhook.match.event) {
    return {
      sourcePath: path,
      config: webhook,
      normalizedAddresses
    };
  }

  const eventMatcher = await resolveEventFragment({
    eventName: webhook.match.event.name,
    inlineAbi: webhook.match.event.abi.inline,
    abiFile: webhook.match.event.abi.file,
    webhookPath: path
  });

  return {
    sourcePath: path,
    config: webhook,
    normalizedAddresses,
    eventMatcher
  };
}
