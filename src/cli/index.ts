import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import { decodeCandidate } from '../matchers/decode.js';
import { filterMatches } from '../matchers/filter.js';
import { loadProjectConfig } from '../config/loadProjectConfig.js';
import { renderRequest } from '../delivery/renderRequest.js';
import type { Candidate, RenderContext } from '../shared/types.js';

const program = new Command();

program
  .name('vechain.webhooks')
  .description('CLI helpers for validating and previewing webhook rules.');

program
  .command('validate')
  .requiredOption('--config <path>', 'Path to config/runtime.yml')
  .action(async (options: { config: string }) => {
    const project = await loadProjectConfig(options.config);
    process.stdout.write(
      `Configuration is valid. Loaded ${project.webhooks.length} webhook file(s).\n`
    );
  });

program
  .command('print-rules')
  .requiredOption('--config <path>', 'Path to config/runtime.yml')
  .action(async (options: { config: string }) => {
    const project = await loadProjectConfig(options.config);
    const printable = project.webhooks.map((webhook) => ({
      id: webhook.config.id,
      enabled: webhook.config.enabled,
      kind: webhook.config.match.kind,
      addresses: webhook.normalizedAddresses,
      topic0: webhook.eventMatcher?.topic0
    }));
    process.stdout.write(`${JSON.stringify(printable, null, 2)}\n`);
  });

program
  .command('dry-run')
  .requiredOption('--config <path>', 'Path to config/runtime.yml')
  .requiredOption('--webhook <id>', 'Webhook id defined in config/webhooks')
  .requiredOption('--fixture <path>', 'Path to a JSON fixture describing a candidate')
  .action(
    async (options: { config: string; fixture: string; webhook: string }) => {
      const project = await loadProjectConfig(options.config);
      const webhook = project.webhooks.find(
        (entry) => entry.config.id === options.webhook
      );

      if (!webhook) {
        throw new Error(
          `Webhook "${options.webhook}" was not found. Check config/webhooks and pass a known id.`
        );
      }

      const fixture = JSON.parse(
        await readFile(options.fixture, 'utf8')
      ) as Candidate;
      const decoded = decodeCandidate(fixture, webhook);
      const context = toRenderContext(project.runtimeConfig.network, webhook.config.id, fixture, decoded);

      if (!filterMatches(webhook.config.filters, context)) {
        throw new Error(
          `Webhook "${webhook.config.id}" did not match the provided fixture. Update the fixture or relax the filters before retrying.`
        );
      }

      const request = renderRequest({
        webhook,
        context,
        runtimeConfig: project.runtimeConfig,
        env: process.env
      });
      process.stdout.write(`${JSON.stringify(request, null, 2)}\n`);
    }
  );

await program.parseAsync(process.argv);

function toRenderContext(
  network: 'main' | 'test',
  webhookId: string,
  candidate: Candidate,
  decoded: Record<string, unknown>
): RenderContext {
  return {
    decoded,
    event: candidate.event as unknown as Record<string, unknown>,
    meta: candidate.meta as unknown as Record<string, unknown>,
    network: {
      name: network
    },
    webhook: {
      id: webhookId
    }
  };
}
