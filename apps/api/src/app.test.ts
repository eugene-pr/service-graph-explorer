import { describe, expect, it } from 'vitest';
import { FiltersResponse, Problem } from '@sge/domain';
import { z } from 'zod';
import { buildApp } from './app.js';
import { fixtureFilters } from './test/fixtureFilters.js';
import { loadGraph } from './graph/loadGraph.js';

const graph = loadGraph({
  nodes: [
    { name: 'web', kind: 'service', publicExposed: true },
    {
      name: 'db',
      kind: 'rds',
      vulnerabilities: [{ file: 'db.sql', severity: 'high', message: 'm' }],
    },
  ],
  edges: [{ from: 'web', to: ['db', 'missing'] }],
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp(graph);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /api/filters', () => {
  it('returns the Filter Catalog with params as JSON Schema', async () => {
    const app = buildApp(graph, { filters: fixtureFilters });
    const res = await app.inject({ method: 'GET', url: '/api/filters' });

    expect(res.statusCode).toBe(200);
    const { filters } = FiltersResponse.parse(res.json());
    expect(filters.map((f) => f.name)).toEqual(['startsAtEntry', 'startsAtPublic', 'visits', 'endsAtKind', 'maxHops']);
    expect(filters.find((f) => f.name === 'visits')).toMatchObject({
      description: 'Passes through the named node.',
      position: 'any',
      params: { type: 'object', properties: { node: { type: 'string' } }, required: ['node'] },
    });
  });
});

describe('GET /api/routes', () => {
  const routes = async (query: string) => {
    const app = buildApp(graph, { filters: fixtureFilters });
    return app.inject({ method: 'GET', url: `/api/routes${query}` });
  };

  it('with no params, runs the default view with the default limit', async () => {
    const res = await routes('');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      routes: [
        ['web', 'db'],
        ['web', 'missing'],
      ],
      meta: { routeCount: 2, truncated: false, limit: 100, effectiveQuery: { and: [{ filter: 'startsAtEntry' }] } },
    });
  });

  it('parses comma-separated Filters, namespaced params and the limit', async () => {
    const res = await routes('?filters=startsAtPublic,visits&visits.node=db&limit=1');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      nodes: [{ id: 'web' }, { id: 'db' }],
      edges: [{ id: 'web->db', source: 'web', target: 'db' }],
      routes: [['web', 'db']],
      meta: {
        routeCount: 1,
        limit: 1,
        effectiveQuery: { and: [{ filter: 'startsAtPublic' }, { filter: 'visits', params: { node: 'db' } }] },
        warnings: [expect.stringContaining('"missing"')],
      },
    });
  });

  it('decodes params from their query-string form using each param schema: lists by comma, numbers', async () => {
    const res = await routes('?filters=endsAtKind,maxHops&endsAtKind.kinds=rds,sqs&maxHops.hops=1');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      routes: [['web', 'db']],
      meta: {
        effectiveQuery: {
          and: [
            { filter: 'startsAtEntry' },
            { filter: 'endsAtKind', params: { kinds: ['rds', 'sqs'] } },
            { filter: 'maxHops', params: { hops: 1 } },
          ],
        },
      },
    });
  });

  it.each([
    ['a param that is not a number', '?filters=maxHops&maxHops.hops=lots', [{ filter: 'maxHops', param: 'hops' }]],
    ['an unknown Filter', '?filters=nope', [{ filter: 'nope' }]],
    ['a missing required param', '?filters=visits', [{ filter: 'visits', param: 'node' }]],
    ['an unknown param', '?filters=visits&visits.node=db&visits.bogus=1', [{ filter: 'visits', param: 'bogus' }]],
    ['a param for a Filter not in `filters`', '?visits.node=db', [{ filter: 'visits', param: 'node' }]],
    ['a repeated Filter', '?filters=startsAtPublic,startsAtPublic', [{ filter: 'startsAtPublic' }]],
    ['a limit over the maximum', '?limit=1001', [{ param: 'limit' }]],
    ['a limit that is not a number', '?limit=lots', [{ param: 'limit' }]],
  ])('returns 400 problem details for %s, naming the Filter and param', async (_case, query, errors) => {
    const res = await routes(query);

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const problem = Problem.parse(res.json());
    expect(problem).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400 });
    expect(problem.errors?.map(({ filter, param }) => ({ filter, param }))).toEqual(errors);
  });
});

describe('errors', () => {
  it('returns 404 problem details for an unknown path', async () => {
    const res = await buildApp(graph).inject({ method: 'GET', url: '/api/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toMatchObject({ type: 'about:blank', title: 'Not Found', status: 404 });
  });
});

describe('API docs', () => {
  it('serves Swagger UI at /docs and an OpenAPI document generated from the schemas', async () => {
    const app = buildApp(graph);

    const ui = await app.inject({ method: 'GET', url: '/docs/' });
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toMatch(/text\/html/);

    const spec = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = z
      .looseObject({ paths: z.record(z.string(), z.unknown()), components: z.object({ schemas: z.record(z.string(), z.unknown()) }) })
      .parse(spec.json());
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/api/graph', '/api/filters', '/api/routes']));
    const refs = [...spec.body.matchAll(/"#\/components\/schemas\/([^"]+)"/g)].map(([, name]) => name ?? '');
    for (const name of refs) expect(doc.components.schemas).toHaveProperty(name);
  });
});

describe('GET /api/graph', () => {
  it('returns nodes as {id, data}, edges as {id, source, target}, and load warnings', async () => {
    const app = buildApp(graph);
    const res = await app.inject({ method: 'GET', url: '/api/graph' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      nodes: [
        { id: 'web', data: { name: 'web', kind: 'service', publicExposed: true, vulnerabilities: [], inferred: false } },
        {
          id: 'db',
          data: {
            name: 'db',
            kind: 'rds',
            publicExposed: false,
            vulnerabilities: [{ file: 'db.sql', severity: 'high', message: 'm' }],
            inferred: false,
          },
        },
        { id: 'missing', data: { name: 'missing', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: true } },
      ],
      edges: [
        { id: 'web->db', source: 'web', target: 'db' },
        { id: 'web->missing', source: 'web', target: 'missing' },
      ],
      meta: { warnings: [expect.stringContaining('"missing"')] },
    });
  });
});
