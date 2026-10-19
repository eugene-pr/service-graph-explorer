import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FiltersResponse, GraphResponse, HealthResponse, Limit, Problem, RoutesQueryRequest, RoutesResponse } from '@sge/domain';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginCallbackZod,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { findRoutes } from './engine/findRoutes.js';
import type { Filters } from './filters/filter.js';
import { filters as catalogFilters } from './filters/index.js';
import type { Graph } from './graph/graph.js';
import { parseFlatQuery } from './http/flatQuery.js';
import { useProblemDetails, type NotFoundFallback } from './http/problem.js';

export interface AppOptions extends FastifyServerOptions {
  /** The Filters Queries may use; defaults to the Filter Catalog's. */
  filters?: Filters;
  /** Absolute path to the built web app; when set, it is served at `/` with a fallback to the SPA. */
  webDist?: string;
}

const RoutesQueryString = z.looseObject({
  filters: z.string().optional().describe('Comma-separated Filter names, all of which must hold.'),
  limit: Limit.describe('Most Routes to return.'),
});

/** A GET for an app page, not for the API, the docs or an asset file: answered with the SPA's `index.html`. */
const spaFallback: NotFoundFallback = (request, reply) => {
  const path = request.url.split('?')[0] ?? '';
  const isPage = request.method === 'GET' && !/^\/(api|docs|health)(\/|$)/.test(path) && !/\.[^/]*$/.test(path);
  return isPage ? reply.sendFile('index.html') : undefined;
};

export function buildApp(graph: Graph, { filters = catalogFilters, webDist, ...options }: AppOptions = {}) {
  const app = Fastify(options);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  useProblemDetails(app, webDist ? spaFallback : undefined);
  if (webDist) void app.register(fastifyStatic, { root: webDist });

  void app.register(swagger, {
    openapi: { info: { title: 'Service Graph Explorer API', version: '1.0.0' } },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  void app.register(swaggerUi, { routePrefix: '/docs' });

  const filtersResponse: FiltersResponse = {
    filters: [...filters.values()].map(({ name, description, position, paramsJsonSchema }) => ({
      name,
      description,
      position,
      params: paramsJsonSchema,
    })),
  };

  const routes: FastifyPluginCallbackZod = (api, _options, done) => {
    api.get('/health', { schema: { response: { 200: HealthResponse } } }, () => ({ status: 'ok' as const }));

    api.get('/api/graph', { schema: { response: { 200: GraphResponse } } }, () => graph.toResponse());

    api.get('/api/filters', { schema: { response: { 200: FiltersResponse } } }, () => filtersResponse);

    api.get(
      '/api/routes',
      {
        schema: {
          description: 'Runs a flat AND Query. Params are namespaced by Filter: `<filter>.<param>=<value>`.',
          querystring: RoutesQueryString,
          response: { 200: RoutesResponse, 400: Problem },
        },
      },
      (request) => findRoutes(graph, parseFlatQuery(request.query, filters), { limit: request.query.limit, filters }),
    );
    api.post(
      '/api/routes/query',
      {
        schema: {
          description: 'Runs a Query tree of Filter leaves combined with `and`, `or` and `not`. Allows repeated Filters with separate params.',
          body: RoutesQueryRequest,
          response: { 200: RoutesResponse, 400: Problem },
        },
      },
      (request) => findRoutes(graph, request.body.query, { limit: request.body.limit, filters }),
    );
    done();
  };
  void app.register(routes);

  return app;
}
