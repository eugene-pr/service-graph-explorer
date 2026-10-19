import type { FilterCatalog, Query } from '@sge/domain';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createFilters } from '../filters/filter.js';
import { DEFAULT_GRAPH_FILE, loadGraph, loadGraphFile } from '../graph/loadGraph.js';
import { fixtureCatalog, fixtureFilters, fixtureImplementations } from '../test/fixtureFilters.js';
import { findRoutes, QueryError } from './findRoutes.js';

const service = (name: string, publicExposed = false) => ({ name, kind: 'service', publicExposed });

// a(public) -> b -> db
//           -> c -> db
// x -> b
const graph = loadGraph({
  nodes: [service('a', true), service('b'), service('c'), { name: 'db', kind: 'rds' }, service('x')],
  edges: [
    { from: 'a', to: ['b', 'c'] },
    { from: 'b', to: 'db' },
    { from: 'c', to: 'db' },
    { from: 'x', to: 'b' },
  ],
});

describe('findRoutes', () => {
  it('with an empty Query, returns Routes from Entries to nodes with no outgoing edges', () => {
    const result = findRoutes(graph, { and: [] }, { limit: 100 });

    expect(result.routes).toEqual([
      ['a', 'b', 'db'],
      ['a', 'c', 'db'],
      ['x', 'b', 'db'],
    ]);
  });

  it('with a start Filter in the top-level `and`, starts only there and adds no default', () => {
    const query = { and: [{ filter: 'startsAtPublic' }] };
    const result = findRoutes(graph, query, { limit: 100 });

    expect(result.routes).toEqual([
      ['a', 'b', 'db'],
      ['a', 'c', 'db'],
    ]);
    expect(result.meta.effectiveQuery).toEqual(query);
  });

  it('adds `startsAtEntry` to an empty Query, and reports it in `effectiveQuery`', () => {
    const result = findRoutes(graph, { and: [] }, { limit: 100 });

    expect(result.meta.effectiveQuery).toEqual({ and: [{ filter: 'startsAtEntry' }] });
  });

  it('adds `startsAtEntry` to a flat Query with no start Filter', () => {
    const query = { and: [{ filter: 'visits', params: { node: 'c' } }] };
    const result = findRoutes(graph, query, { limit: 100, filters: fixtureFilters });

    expect(result.routes).toEqual([['a', 'c', 'db']]);
    expect(result.meta.effectiveQuery).toEqual({ and: [{ filter: 'startsAtEntry' }, ...query.and] });
  });

  it('runs a registered fixture Filter with its params', () => {
    const result = findRoutes(graph, { and: [{ filter: 'visits', params: { node: 'b' } }] }, { limit: 100, filters: fixtureFilters });

    expect(result.routes).toEqual([
      ['a', 'b', 'db'],
      ['x', 'b', 'db'],
    ]);
  });

  it('returns the union of the matched Routes as nodes and edges', () => {
    const result = findRoutes(graph, { and: [{ filter: 'visits', params: { node: 'c' } }] }, { limit: 100, filters: fixtureFilters });

    expect(result.nodes).toEqual([
      { id: 'a', data: graph.node('a') },
      { id: 'c', data: graph.node('c') },
      { id: 'db', data: graph.node('db') },
    ]);
    expect(result.edges.map((e) => e.id)).toEqual(['a->c', 'c->db']);
  });

  it('only counts as Routes the paths that end at a node with no outgoing edges', () => {
    // Every path from s runs into the cycle b <-> c, so no Route ends there; s -> d is the only Route.
    const cyclic = loadGraph({
      nodes: [service('s'), service('b'), service('c'), service('d')],
      edges: [
        { from: 's', to: ['b', 'd'] },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'b' },
      ],
    });

    expect(findRoutes(cyclic, { and: [] }, { limit: 100 }).routes).toEqual([['s', 'd']]);
  });

  it('follows cycles without repeating a node', () => {
    // s -> a -> b -> a (cycle), b -> end
    const cyclic = loadGraph({
      nodes: [service('s'), service('a'), service('b'), service('end')],
      edges: [
        { from: 's', to: 'a' },
        { from: 'a', to: 'b' },
        { from: 'b', to: ['a', 'end'] },
      ],
    });

    expect(findRoutes(cyclic, { and: [] }, { limit: 100 }).routes).toEqual([['s', 'a', 'b', 'end']]);
  });

  it('has no Route from an isolated node', () => {
    const lonely = loadGraph({ nodes: [service('alone')], edges: [] });

    expect(findRoutes(lonely, { and: [] }, { limit: 100 }).routes).toEqual([]);
  });

  it('orders Routes by source data: start candidates by node order, neighbors by edge order', () => {
    const reordered = loadGraph({
      nodes: [service('z'), service('m'), service('y1'), service('y2')],
      edges: [
        { from: 'm', to: ['y2', 'y1'] },
        { from: 'z', to: 'y1' },
      ],
    });

    expect(findRoutes(reordered, { and: [] }, { limit: 100 }).routes).toEqual([
      ['z', 'y1'],
      ['m', 'y2'],
      ['m', 'y1'],
    ]);
  });

  describe('limit', () => {
    it('with exactly `limit` matching Routes, returns them all, not truncated', () => {
      const result = findRoutes(graph, { and: [] }, { limit: 3 });

      expect(result.routes).toHaveLength(3);
      expect(result.meta).toMatchObject({ routeCount: 3, truncated: false, limit: 3 });
    });

    it('with `limit + 1` matching Routes, returns the first `limit`, truncated', () => {
      const result = findRoutes(graph, { and: [] }, { limit: 2 });

      expect(result.routes).toEqual([
        ['a', 'b', 'db'],
        ['a', 'c', 'db'],
      ]);
      expect(result.meta).toMatchObject({ routeCount: 2, truncated: true, limit: 2 });
    });

    it('returns the same Routes on repeated runs', () => {
      const run = () => findRoutes(graph, { and: [] }, { limit: 2 }).routes;

      expect(run()).toEqual(run());
    });
  });

  describe('errors', () => {
    const errorsOf = (query: Query) => {
      try {
        findRoutes(graph, query, { limit: 100, filters: fixtureFilters });
      } catch (error) {
        if (error instanceof QueryError) return error.errors;
      }
      throw new Error('Expected a QueryError');
    };

    it('rejects an unknown Filter, naming it', () => {
      const [error, ...rest] = errorsOf({ and: [{ filter: 'nope' }] });

      expect(rest).toEqual([]);
      expect(error).toMatchObject({ filter: 'nope' });
      expect(error?.message).toMatch(/unknown filter/i);
    });

    it('rejects params that do not fit the schema, naming the Filter and param', () => {
      expect(errorsOf({ and: [{ filter: 'visits', params: { node: 42 } }] })).toMatchObject([{ filter: 'visits', param: 'node' }]);
      expect(errorsOf({ and: [{ filter: 'visits', params: { node: 'b', extra: 1 } }] })).toMatchObject([
        { filter: 'visits', param: 'extra' },
      ]);
    });
  });
});

describe('endsAtSink', () => {
  // s -> api -> db(rds), q(sqs), cache(redis), leaf(service)
  const sinks = loadGraph({
    nodes: [
      service('s'),
      service('api'),
      { name: 'db', kind: 'rds' },
      { name: 'q', kind: 'sqs' },
      { name: 'cache', kind: 'redis' },
      service('leaf'),
    ],
    edges: [
      { from: 's', to: 'api' },
      { from: 'api', to: ['db', 'q', 'cache', 'leaf'] },
    ],
  });

  it('by default, counts every kind except `service` as a Sink', () => {
    const result = findRoutes(sinks, { and: [{ filter: 'endsAtSink' }] }, { limit: 100 });

    expect(result.routes).toEqual([
      ['s', 'api', 'db'],
      ['s', 'api', 'q'],
      ['s', 'api', 'cache'],
    ]);
  });

  it('with `kinds`, counts only those kinds as Sinks', () => {
    const query = { and: [{ filter: 'endsAtSink', params: { kinds: ['rds', 'sqs'] } }] };

    expect(findRoutes(sinks, query, { limit: 100 }).routes).toEqual([
      ['s', 'api', 'db'],
      ['s', 'api', 'q'],
    ]);
  });

  it('rejects a kind not present in the graph, naming the Filter and param', () => {
    const query = { and: [{ filter: 'endsAtSink', params: { kinds: ['rds', 'mongo'] } }] };

    const error = (() => {
      try {
        findRoutes(sinks, query, { limit: 100 });
      } catch (error) {
        return error;
      }
    })();

    expect(error).toBeInstanceOf(QueryError);
    expect(error instanceof QueryError && error.errors).toMatchObject([{ filter: 'endsAtSink', param: 'kinds' }]);
    expect(error instanceof QueryError && error.errors[0]?.message).toMatch(/"mongo"/);
  });
});

describe('pruning', () => {
  /** Checks the last node's kind as a whole-Route Filter, which never drives pruning: an unpruned twin of `endsAtSink`. */
  const filters = createFilters(
    {
      ...fixtureCatalog,
      endsAtKindUnpruned: {
        description: 'Last node is of one of these kinds.',
        position: 'route',
        params: z.strictObject({ kinds: z.array(z.string()) }),
      },
    } satisfies FilterCatalog,
    {
      ...fixtureImplementations,
      endsAtKindUnpruned: ({ kinds }, g) => ({ route: (route) => kinds.includes(g.node(route.at(-1) ?? '')?.kind ?? '') }),
    },
  );

  // s -> dead -> d1, d2, d3 (services: a dead-end branch for a Sink Query)
  // s -> mid -> db(rds), m1(service)
  // t -> mid
  const branching = loadGraph({
    nodes: [
      service('s'),
      service('dead'),
      service('d1'),
      service('d2'),
      service('d3'),
      service('mid'),
      { name: 'db', kind: 'rds' },
      service('m1'),
      service('t'),
      { name: 'q', kind: 'sqs' },
    ],
    edges: [
      { from: 's', to: ['dead', 'mid'] },
      { from: 'dead', to: ['d1', 'd2', 'd3'] },
      { from: 'mid', to: ['db', 'm1'] },
      { from: 't', to: ['mid', 'q'] },
    ],
  });

  it.each([
    ['default Sink kinds', undefined],
    ['custom Sink kinds', ['rds']],
  ])('returns the same Routes as an unpruned search, with %s, with and without a limit', (_case, kinds) => {
    const endKinds = kinds ?? branching.sinkKinds;
    const pruned = (limit: number) =>
      findRoutes(branching, { and: [{ filter: 'endsAtSink', ...(kinds && { params: { kinds } }) }] }, { limit, filters });
    const unpruned = (limit: number) =>
      findRoutes(branching, { and: [{ filter: 'endsAtKindUnpruned', params: { kinds: [...endKinds] } }] }, { limit, filters });

    for (const limit of [1, 2, 100]) {
      const [a, b] = [pruned(limit), unpruned(limit)];
      expect(a.routes).toEqual(b.routes);
      expect(a.meta.truncated).toBe(b.meta.truncated);
    }
  });
});

describe('findRoutes on the bundled data', () => {
  it('finds Routes from the public `frontend` only, for `startsAtPublic`', async () => {
    const real = await loadGraphFile(DEFAULT_GRAPH_FILE);
    const result = findRoutes(real, { and: [{ filter: 'startsAtPublic' }] }, { limit: 1000 });

    expect(result.routes.length).toBeGreaterThan(0);
    expect(new Set(result.routes.map((route) => route[0]))).toEqual(new Set(['frontend']));
  });

  it('finds no Route for `startsAtPublic` + `endsAtSink`', async () => {
    const real = await loadGraphFile(DEFAULT_GRAPH_FILE);
    const result = findRoutes(real, { and: [{ filter: 'startsAtPublic' }, { filter: 'endsAtSink' }] }, { limit: 1000 });

    expect(result.routes).toEqual([]);
    expect(result.meta.truncated).toBe(false);
  });
});
