import Fastify, { type FastifyServerOptions } from 'fastify';
import type { HealthResponse } from '@sge/domain';

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get('/health', (): HealthResponse => ({ status: 'ok' }));

  return app;
}
