import Fastify, { type FastifyInstance } from 'fastify';

import type { Processor } from '../runtime/processor.js';

export function createHttpServer(options: {
  processor: Processor;
}): FastifyInstance {
  const app = Fastify({
    logger: false
  });
  const { processor } = options;

  app.get('/health', async () => {
    const state = processor.getState();
    return {
      status: 'ok',
      ...state
    };
  });

  app.get('/ready', async (_request, reply) => {
    const state = processor.getState();
    if (!state.ready) {
      return reply.code(503).send({
        status: 'starting',
        ...state
      });
    }

    return {
      status: 'ready',
      ...state
    };
  });

  return app;
}
