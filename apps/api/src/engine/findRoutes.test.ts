import type { FilterCatalog, Query } from '@sge/domain';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createFilters } from '../filters/filter.js';
import type { Graph } from '../graph/graph.js';
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

/** The errors of the `QueryError` that running `query` throws. */
const errorsOf = (query: Query, on: Graph = graph) => {
  try {
    findRoutes(on, query, { limit: 100, filters: fixtureFilters });
  } catch (error) {
    if (error instanceof QueryError) return error.errors;
  }
  throw new Error('Expected a QueryError');
};

/** The three Filters the task requires, combined. */
const toxicQuery = { and: [{ filter: 'startsAtPublic' }, { filter: 'endsAtSink' }, { filter: 'hasVulnerability' }] };

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

describe('Query trees', () => {
  it.each<[Query, string[][]]>([
    [{ filter: 'startsAtPublic' }, []],
    [{ or: [{ filter: 'startsAtPublic' }, { filter: 'passesThrough', params: { node: 'b' } }] }, [['a', 'b', 'db']]],
    [{ not: { filter: 'startsAtPublic' } }, [['a', 'b', 'db']]],
    [{ and: [{ or: [{ filter: 'startsAtPublic' }, { filter: 'passesThrough', params: { node: 'b' } }] }] }, [['a', 'b', 'db']]],
    [{ and: [{ and: [{ filter: 'startsAtPublic' }] }] }, []],
  ])('adds the Entry default when a start Filter is not a direct top-level member: %j', (query, expected) => {
    // `b` is public but is not an Entry, so considering its start Filter for candidates would admit a tail Route.
    const nonEntryPublic = loadGraph({
      nodes: [service('a'), service('b', true), { name: 'db', kind: 'rds' }],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'db' }],
    });
    const result = findRoutes(nonEntryPublic, query, { limit: 100 });

    expect(result.meta.effectiveQuery).toEqual({ and: [{ filter: 'startsAtEntry' }, ...('and' in query ? query.and : [query])] });
    expect(result.routes).toEqual(expected);
  });

  it('combines nested trees and repeated Filters without merging their params', () => {
    const query = { and: [
      { filter: 'startsAtPublic' },
      { filter: 'passesThrough', params: { node: 'a' } },
      { or: [
        { and: [
          { filter: 'passesThrough', params: { node: 'b' } },
          { not: { filter: 'passesThrough', params: { node: 'c' } } },
        ] },
        { not: { not: { filter: 'passesThrough', params: { node: 'x' } } } },
      ] },
    ] };
    const result = findRoutes(graph, query, { limit: 100 });

    expect(result.routes).toEqual([['a', 'b', 'db']]);
    expect(result.meta.effectiveQuery).toEqual(query);
  });

  it('validates every branch and identifies each Filter in the submitted tree', () => {
    const query = {
      and: [
        { or: [
          { filter: 'passesThrough', params: { node: 'db' } },
          { filter: 'passesThrough', params: { node: 'missing' } },
          { not: { filter: 'maxLength', params: { hops: 'two' } } },
        ] },
        { not: { filter: 'endsAtSink', params: { kinds: ['mongo'] } } },
        { filter: 'nope' },
      ],
    };

    expect(errorsOf(query)).toMatchObject([
      { filter: 'passesThrough', param: 'node', path: 'query.and.0.or.1' },
      { filter: 'maxLength', param: 'hops', path: 'query.and.0.or.2.not' },
      { filter: 'endsAtSink', param: 'kinds', path: 'query.and.1.not' },
      { filter: 'nope', path: 'query.and.2' },
    ]);
  });

  it('negates a Filter with a `not` root and adds the Entry default', () => {
    const query = { not: { filter: 'passesThrough', params: { node: 'b' } } };
    const result = findRoutes(graph, query, { limit: 100 });

    expect(result.routes).toEqual([['a', 'c', 'db']]);
    expect(result.meta.effectiveQuery).toEqual({ and: [{ filter: 'startsAtEntry' }, query] });
  });

  it('matches either branch of an `or` and reports the added Entry default', () => {
    const query = { or: [{ filter: 'passesThrough', params: { node: 'c' } }, { filter: 'passesThrough', params: { node: 'x' } }] };
    const result = findRoutes(graph, query, { limit: 100 });

    expect(result.routes).toEqual([['a', 'c', 'db'], ['x', 'b', 'db']]);
    expect(result.meta.effectiveQuery).toEqual({ and: [{ filter: 'startsAtEntry' }, query] });
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

    const errors = errorsOf(query, sinks);

    expect(errors).toMatchObject([{ filter: 'endsAtSink', param: 'kinds' }]);
    expect(errors[0]?.message).toMatch(/"mongo"/);
  });
});

describe('hasVulnerability', () => {
  const vulnerable = (name: string, ...severities: string[]) => ({
    ...service(name),
    vulnerabilities: severities.map((severity) => ({ file: `${name}.java`, severity, message: 'finding' })),
  });

  // s -> v-<severity> for each severity, s -> clean; v-mixed holds a low and a high
  const bySeverity = loadGraph({
    nodes: [
      service('s'),
      vulnerable('v-unknown', 'bogus'),
      vulnerable('v-low', 'low'),
      vulnerable('v-medium', 'medium'),
      vulnerable('v-high', 'high'),
      vulnerable('v-critical', 'critical'),
      vulnerable('v-mixed', 'low', 'high'),
      service('clean'),
    ],
    edges: [{ from: 's', to: ['v-unknown', 'v-low', 'v-medium', 'v-high', 'v-critical', 'v-mixed', 'clean'] }],
  });
  const lastNodes = (params?: Record<string, unknown>) =>
    findRoutes(bySeverity, { and: [{ filter: 'hasVulnerability', ...(params && { params }) }] }, { limit: 100 }).routes.map(
      (route) => route.at(-1),
    );

  it('without `minSeverity`, matches a Route through any vulnerable node, including `unknown` severity', () => {
    expect(lastNodes()).toEqual(['v-unknown', 'v-low', 'v-medium', 'v-high', 'v-critical', 'v-mixed']);
  });

  it('matches when the vulnerable node is anywhere on the Route, not only at its end', () => {
    // entry(vulnerable) -> mid -> end
    const vulnerableEntry = loadGraph({
      nodes: [vulnerable('entry', 'low'), service('mid'), service('end')],
      edges: [
        { from: 'entry', to: 'mid' },
        { from: 'mid', to: 'end' },
      ],
    });

    expect(findRoutes(vulnerableEntry, { and: [{ filter: 'hasVulnerability' }] }, { limit: 100 }).routes).toEqual([['entry', 'mid', 'end']]);
  });

  it.each([
    ['low', ['v-low', 'v-medium', 'v-high', 'v-critical', 'v-mixed']],
    ['medium', ['v-medium', 'v-high', 'v-critical', 'v-mixed']],
    ['high', ['v-high', 'v-critical', 'v-mixed']],
    ['critical', ['v-critical']],
  ])('with `minSeverity: %s`, matches that severity or above, never `unknown`', (minSeverity, expected) => {
    expect(lastNodes({ minSeverity })).toEqual(expected);
  });

  it('rejects a `minSeverity` outside low/medium/high/critical, naming the Filter and param', () => {
    for (const minSeverity of ['unknown', 'severe']) {
      expect(errorsOf({ and: [{ filter: 'hasVulnerability', params: { minSeverity } }] }, bySeverity)).toMatchObject([
        { filter: 'hasVulnerability', param: 'minSeverity' },
      ]);
    }
  });

  it('with `startsAtPublic` + `endsAtSink` + `hasVulnerability`, returns only the Routes matching all three', () => {
    // web(public) -> api(high) -> db(rds)    all three
    // web(public) -> safe -> db(rds)         no vulnerability
    // web(public) -> api(high) -> log        not a Sink
    // internal -> api(high) -> db(rds)       not public
    const toxic = loadGraph({
      nodes: [service('web', true), vulnerable('api', 'high'), service('safe'), { name: 'db', kind: 'rds' }, service('log'), service('internal')],
      edges: [
        { from: 'web', to: ['api', 'safe'] },
        { from: 'api', to: ['db', 'log'] },
        { from: 'safe', to: 'db' },
        { from: 'internal', to: 'api' },
      ],
    });
    expect(findRoutes(toxic, toxicQuery, { limit: 100 }).routes).toEqual([['web', 'api', 'db']]);
  });
});

describe('passesThrough', () => {
  it('matches the Routes that include the node, wherever it is on them', () => {
    expect(findRoutes(graph, { and: [{ filter: 'passesThrough', params: { node: 'b' } }] }, { limit: 100 }).routes).toEqual([
      ['a', 'b', 'db'],
      ['x', 'b', 'db'],
    ]);
    expect(findRoutes(graph, { and: [{ filter: 'passesThrough', params: { node: 'a' } }] }, { limit: 100 }).routes).toEqual([
      ['a', 'b', 'db'],
      ['a', 'c', 'db'],
    ]);
  });

  it('rejects a node not in the graph, naming the Filter and param', () => {
    const errors = errorsOf({ and: [{ filter: 'passesThrough', params: { node: 'nope' } }] });

    expect(errors).toMatchObject([{ filter: 'passesThrough', param: 'node' }]);
    expect(errors[0]?.message).toMatch(/"nope"/);
  });

  it('rejects a missing or empty node, naming the Filter and param', () => {
    for (const params of [{}, { node: '' }]) {
      expect(errorsOf({ and: [{ filter: 'passesThrough', params }] })).toMatchObject([{ filter: 'passesThrough', param: 'node' }]);
    }
  });
});

describe('maxLength', () => {
  // s -> e1                1 hop
  // s -> m -> e2           2 hops
  // s -> m -> n -> e3      3 hops
  // s -> m -> n -> p -> m  cycle back into the Route
  const lengths = loadGraph({
    nodes: [service('s'), service('e1'), service('m'), service('e2'), service('n'), service('e3'), service('p')],
    edges: [
      { from: 's', to: ['e1', 'm'] },
      { from: 'm', to: ['e2', 'n'] },
      { from: 'n', to: ['e3', 'p'] },
      { from: 'p', to: 'm' },
    ],
  });
  const maxLength = (hops: unknown) => ({ filter: 'maxLength', params: { hops } });

  it('keeps longer Routes when `maxLength` is inside `or` or `not`', () => {
    expect(findRoutes(lengths, { and: [{ or: [maxLength(1), { filter: 'passesThrough', params: { node: 'n' } }] }] }, { limit: 100 }).routes)
      .toEqual([['s', 'e1'], ['s', 'm', 'n', 'e3']]);
    expect(findRoutes(lengths, { not: maxLength(1) }, { limit: 100 }).routes)
      .toEqual([['s', 'm', 'e2'], ['s', 'm', 'n', 'e3']]);
  });

  it.each([
    [1, [['s', 'e1']]],
    [2, [['s', 'e1'], ['s', 'm', 'e2']]],
    [3, [['s', 'e1'], ['s', 'm', 'e2'], ['s', 'm', 'n', 'e3']]],
  ])('with `hops: %i`, matches Routes with at most that many edges', (hops, expected) => {
    expect(findRoutes(lengths, { and: [maxLength(hops)] }, { limit: 100 }).routes).toEqual(expected);
  });

  it('returns the same Routes as without the depth limit, with and without a limit', () => {
    // A nested `and` isn't a direct member of the top-level `and`, so it doesn't limit search depth.
    for (const hops of [1, 2, 3, 4]) {
      for (const limit of [1, 2, 100]) {
        const bounded = findRoutes(lengths, { and: [maxLength(hops)] }, { limit });
        const unbounded = findRoutes(lengths, { and: [{ and: [maxLength(hops)] }] }, { limit });
        expect(bounded.routes).toEqual(unbounded.routes);
        expect(bounded.meta.truncated).toBe(unbounded.meta.truncated);
      }
    }
  });

  it('stops the search at the `maxEdges` of a route Filter in the top-level `and`, never one nested deeper', () => {
    // Accepts every Route, so only the depth limit can drop the longer ones.
    const filters = createFilters(
      {
        ...fixtureCatalog,
        depthLimitOnly: { description: 'Limits depth, matches all.', position: 'route', params: z.strictObject({}) },
      } satisfies FilterCatalog,
      { ...fixtureImplementations, depthLimitOnly: () => ({ route: () => true, maxEdges: 2 }) },
    );
    const depthLimitOnly = { filter: 'depthLimitOnly' };

    expect(findRoutes(lengths, { and: [depthLimitOnly] }, { limit: 100, filters }).routes).toEqual([['s', 'e1'], ['s', 'm', 'e2']]);
    expect(findRoutes(lengths, { and: [{ and: [depthLimitOnly] }] }, { limit: 100, filters }).routes).toHaveLength(3);
  });

  it('rejects `hops` below 1 or not an integer, naming the Filter and param', () => {
    for (const hops of [0, 1.5, '2', undefined]) {
      expect(errorsOf({ and: [maxLength(hops)] }, lengths)).toMatchObject([{ filter: 'maxLength', param: 'hops' }]);
    }
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
    {
      name: 'or',
      wrap: (end: Query): Query => ({ and: [{ or: [end, { filter: 'passesThrough', params: { node: 'dead' } }] }] }),
      expected: [['s', 'dead', 'd1'], ['s', 'dead', 'd2'], ['s', 'dead', 'd3'], ['s', 'mid', 'db'], ['t', 'mid', 'db']],
    },
    {
      name: 'not',
      wrap: (end: Query): Query => ({ not: end }),
      expected: [['s', 'dead', 'd1'], ['s', 'dead', 'd2'], ['s', 'dead', 'd3'], ['s', 'mid', 'm1'], ['t', 'mid', 'm1'], ['t', 'q']],
    },
  ])('never prunes using an end Filter inside $name, matching its unpruned twin', ({ wrap, expected }) => {
    const query = wrap({ filter: 'endsAtSink', params: { kinds: ['rds'] } });
    const unprunedQuery = wrap({ filter: 'endsAtKindUnpruned', params: { kinds: ['rds'] } });
    for (const limit of [1, 2, 100]) {
      const result = findRoutes(branching, query, { limit, filters });
      const unpruned = findRoutes(branching, unprunedQuery, { limit, filters });

      expect(result.routes).toEqual(expected.slice(0, limit));
      expect(result.routes).toEqual(unpruned.routes);
      expect(result.meta.truncated).toBe(unpruned.meta.truncated);
    }
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

  // Implied by the empty `startsAtPublic` + `endsAtSink` above; kept as the task's headline Query on the real data.
  it('finds no Route for `startsAtPublic` + `endsAtSink` + `hasVulnerability`', async () => {
    const real = await loadGraphFile(DEFAULT_GRAPH_FILE);
    const result = findRoutes(real, toxicQuery, { limit: 1000 });

    expect(result.routes).toEqual([]);
    expect(result.meta.truncated).toBe(false);
  });
});
