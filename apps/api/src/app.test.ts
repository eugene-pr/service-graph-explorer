import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FiltersResponse, Problem, RoutesResponse } from '@sge/domain';
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
    expect(filters.map((f) => f.name)).toEqual(['startsAtEntry', 'startsAtPublic', 'endsAtSink', 'hasVulnerability', 'passesThrough', 'maxLength', 'visits', 'endsAtKind', 'maxHops']);
    expect(filters.find((f) => f.name === 'visits')).toMatchObject({
      description: 'Passes through the named node.',
      position: 'any',
      params: { type: 'object', properties: { node: { type: 'string' } }, required: ['node'] },
    });
    expect(filters.find((f) => f.name === 'endsAtSink')?.params.properties?.kinds).toMatchObject({
      type: 'array',
      items: { type: 'string' },
      'x-options': 'nodeKinds',
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
    ['an empty sink kind in a list', '?filters=endsAtSink&endsAtSink.kinds=rds,,sqs', [{ filter: 'endsAtSink', param: 'kinds' }]],
    ['a sink kind not in the graph', '?filters=endsAtSink&endsAtSink.kinds=rds,mongo', [{ filter: 'endsAtSink', param: 'kinds' }]],
    ['a maxLength of 0 hops', '?filters=maxLength&maxLength.hops=0', [{ filter: 'maxLength', param: 'hops' }]],
    ['a maxLength that is not an integer', '?filters=maxLength&maxLength.hops=1.5', [{ filter: 'maxLength', param: 'hops' }]],
    ['a passesThrough node not in the graph', '?filters=passesThrough&passesThrough.node=nope', [{ filter: 'passesThrough', param: 'node' }]],
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

describe('POST /api/routes/query', () => {
  it.each([null, [], 'db', 42, true].map((params) => ({ params })))('locates a nested Filter with an invalid params container: %j', async ({ params }) => {
    const res = await buildApp(graph).inject({ method: 'POST', url: '/api/routes/query', payload: {
      query: { and: [{ or: [
        { filter: 'startsAtPublic' },
        { not: { filter: 'passesThrough', params } },
      ] }] },
    } });

    expect(res.statusCode).toBe(400);
    expect(Problem.parse(res.json()).errors).toMatchObject([
      { filter: 'passesThrough', param: 'params', path: 'query.and.0.or.1.not' },
    ]);
  });

  it.each([
    ['a missing Query', {}],
    ['a non-array or', { query: { or: { filter: 'startsAtEntry' } } }],
    ['a null not member', { query: { not: null } }],
    ['an invalid nested member', { query: { and: [{ or: [42] }] } }],
    ['multiple operators', { query: { and: [], or: [] } }],
    ['a leaf with an operator', { query: { filter: 'startsAtPublic', not: { filter: 'startsAtEntry' } } }],
    ['an unknown operator', { query: { xor: [] } }],
    ['an over-limit request', { query: { and: [] }, limit: 1001 }],
  ])('returns 400 problem details for %s', async (_case, payload) => {
    const res = await buildApp(graph).inject({ method: 'POST', url: '/api/routes/query', payload });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const problem = Problem.parse(res.json());
    expect(problem).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400 });
    expect(problem.errors?.length).toBeGreaterThan(0);
  });

  it('accepts a nested JSON tree and serializes the effective Query with the default limit', async () => {
    const app = buildApp(graph, { filters: fixtureFilters });
    const query = { or: [
      { and: [{ filter: 'visits', params: { node: 'web' } }, { not: { filter: 'visits', params: { node: 'missing' } } }] },
      { not: { not: { filter: 'visits', params: { node: 'db' } } } },
    ] };
    const res = await app.inject({ method: 'POST', url: '/api/routes/query', payload: { query } });

    expect(res.statusCode).toBe(200);
    expect(RoutesResponse.parse(res.json()).meta).toMatchObject({
      limit: 100,
      effectiveQuery: { and: [{ filter: 'startsAtEntry' }, query] },
    });
  });

  it('returns RFC 7807 errors with positions in the submitted tree, including repeated Filters', async () => {
    const res = await buildApp(graph).inject({ method: 'POST', url: '/api/routes/query', payload: {
      query: { or: [
        { filter: 'passesThrough', params: { node: 'web' } },
        { filter: 'passesThrough', params: { node: 'typo' } },
        { and: [
          { not: { filter: 'maxLength', params: { hops: 'two' } } },
          { filter: 'endsAtSink', params: { kinds: ['mongo'] } },
          { filter: 'nope' },
        ] },
      ] },
    } });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const problem = Problem.parse(res.json());
    expect(problem).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400 });
    expect(problem.errors).toMatchObject([
      { filter: 'passesThrough', param: 'node', path: 'query.or.1' },
      { filter: 'maxLength', param: 'hops', path: 'query.or.2.and.0.not' },
      { filter: 'endsAtSink', param: 'kinds', path: 'query.or.2.and.1' },
      { filter: 'nope', path: 'query.or.2.and.2' },
    ]);
  });

  it('returns the same response as GET for an equivalent flat Query', async () => {
    const app = buildApp(graph, { filters: fixtureFilters });
    const get = await app.inject({ method: 'GET', url: '/api/routes?filters=startsAtPublic,visits&visits.node=db&limit=1' });
    const post = await app.inject({ method: 'POST', url: '/api/routes/query', payload: {
      query: { and: [{ filter: 'startsAtPublic' }, { filter: 'visits', params: { node: 'db' } }] },
      limit: 1,
    } });

    expect(post.statusCode).toBe(200);
    expect(post.json()).toEqual(get.json());
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

describe('the built web app', () => {
  const webDist = fileURLToPath(new URL('./test/web-dist', import.meta.url));
  const app = buildApp(graph, { webDist });

  it('is served at /', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<div id="root">');
  });

  it('serves its assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app.css' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
  });

  it('falls back to the SPA for a deep link', async () => {
    const res = await app.inject({ method: 'GET', url: '/routes?filters=startsAtPublic', headers: { accept: 'text/html' } });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<div id="root">');
  });

  it('leaves the API, health and docs in place', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ status: 'ok' });
    expect((await app.inject({ method: 'GET', url: '/api/graph' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/docs/' })).statusCode).toBe(200);
  });

  it('runs a Route Query alongside the built web app', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/routes?filters=endsAtSink&endsAtSink.kinds=rds' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.json()).toMatchObject({ routes: [['web', 'db']], meta: { routeCount: 1, truncated: false } });
  });

  it('returns validation problem details alongside the built web app', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/routes?filters=passesThrough&passesThrough.node=absent', headers: { accept: 'text/html' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toMatchObject({
      status: 400, errors: [expect.objectContaining({ filter: 'passesThrough', param: 'node' })],
    });
  });

  it('still returns 404 problem details for an unknown API path or missing asset', async () => {
    for (const url of ['/api/nope', '/assets/missing.js']) {
      const res = await app.inject({ method: 'GET', url, headers: { accept: 'text/html' } });
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    }
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
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/api/graph', '/api/filters', '/api/routes', '/api/routes/query']));
    expect(doc.paths['/api/routes/query']).toHaveProperty(['post', 'requestBody', 'content', 'application/json', 'schema']);
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
      meta: { warnings: [expect.stringContaining('"missing"')], kinds: ['service', 'rds'], sinkKinds: ['rds'] },
    });
  });
});
