import type { Query } from '@sge/domain';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_FILE, loadGraph, loadGraphFile } from '../graph/loadGraph.js';
import { fixtureFilters } from '../test/fixtureFilters.js';
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

describe('findRoutes on the bundled data', () => {
  it('finds Routes from the public `frontend` only, for `startsAtPublic`', async () => {
    const real = await loadGraphFile(DEFAULT_GRAPH_FILE);
    const result = findRoutes(real, { and: [{ filter: 'startsAtPublic' }] }, { limit: 1000 });

    expect(result.routes.length).toBeGreaterThan(0);
    expect(new Set(result.routes.map((route) => route[0]))).toEqual(new Set(['frontend']));
  });
});
