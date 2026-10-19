import Fastify, { type FastifyServerOptions } from 'fastify';
import type { GraphResponse, HealthResponse } from '@sge/domain';
import type { LoadedGraph } from './graph/loadGraph.js';

export function buildApp(graph: LoadedGraph, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  const graphResponse: GraphResponse = {
    nodes: graph.nodes.map((node) => ({ id: node.name, data: node })),
    edges: graph.edges,
    meta: { warnings: graph.warnings },
  };

  app.get('/health', (): HealthResponse => ({ status: 'ok' }));
  app.get('/api/graph', (): GraphResponse => graphResponse);

  return app;
}
