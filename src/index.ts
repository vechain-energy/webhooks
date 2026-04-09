import { loadProjectConfig } from './config/loadProjectConfig.js';
import { createHttpServer } from './http/createServer.js';
import { createProcessor } from './runtime/processor.js';
import { createLogger } from './shared/logger.js';

async function main(): Promise<void> {
  const runtimeConfigPath = process.env.WEBHOOKS_RUNTIME_CONFIG ?? './config/runtime.yml';
  const project = await loadProjectConfig(runtimeConfigPath);
  const logger = createLogger(project.runtimeConfig.logLevel);
  const processor = createProcessor({
    project,
    logger
  });
  const app = createHttpServer({
    processor
  });

  await app.listen({
    host: '0.0.0.0',
    port: project.runtimeConfig.server.port
  });
  logger.info(
    {
      runtimeConfigPath,
      port: project.runtimeConfig.server.port,
      network: project.runtimeConfig.network
    },
    'HTTP server started'
  );
  await processor.start();

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down processor');
    await processor.stop();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

await main();
