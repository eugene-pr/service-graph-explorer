import type { AndQuery, FilterLeaf, FilterName, FilterPosition, ProblemError, Query, RoutesResponse } from '@sge/domain';
import { filters as catalogFilters } from '../filters/index.js';
import type { Filter, Filters, NodeCheck, Route, RouteCheck } from '../filters/filter.js';
import type { Graph } from '../graph/graph.js';

/** The Query names unknown Filters or has params that don't fit their schema. */
export class QueryError extends Error {
  override name = 'QueryError';
  constructor(readonly errors: ProblemError[]) {
    super(errors.map((e) => e.message).join('; '));
  }
}

export interface FindRoutesOptions {
  limit: number;
  /** The Filters a Query may use; defaults to the Filter Catalog's. */
  filters?: Filters;
}

const DEFAULT_START = { filter: 'startsAtEntry' satisfies FilterName };

/**
 * Runs a Query against a graph: the first `limit` matching Routes, in a deterministic order.
 * Throws a `QueryError` for an unknown Filter or bad params.
 */
export function findRoutes(graph: Graph, query: Query, { limit, filters = catalogFilters }: FindRoutesOptions): RoutesResponse {
  const isStartLeaf = (member: Query) => 'filter' in member && filters.get(member.filter)?.position === 'start';
  const effectiveQuery = withDefaultStart(query, isStartLeaf);

  const errors: ProblemError[] = [];
  // Start candidates, pruning and the depth limit read only the Filters directly in the top-level `and`, never `or`/`not` members.
  const topLevelLeaves: PreparedLeaf[] = [];
  const compileTopLevelMember = (member: Query, path: string): RouteMatcher => {
    if (!('filter' in member)) return compile(member, graph, filters, errors, path);
    const prepared = prepareLeaf(member, graph, filters, errors, path);
    if (!prepared) return () => false;
    topLevelLeaves.push(prepared);
    return prepared.matches;
  };
  const members = 'and' in query
    ? query.and.map((member, index) => compileTopLevelMember(member, `query.and.${index}`))
    : [compile(query, graph, filters, errors, 'query')];
  if (effectiveQuery !== query) members.unshift(compileTopLevelMember(DEFAULT_START, 'query'));
  if (errors.length > 0) throw new QueryError(errors);
  const matches: RouteMatcher = (route) => members.every((member) => member(route));
  const checksAt = (position: FilterPosition) => topLevelLeaves.filter((leaf) => leaf.filter.position === position).map((leaf) => leaf.matches);
  const startChecks = checksAt('start');
  const endChecks = checksAt('end');
  const maxEdges = Math.min(...topLevelLeaves.map(({ check }) => ('route' in check ? (check.maxEdges ?? Infinity) : Infinity)));

  // A one-node Route puts its node first and last, so start and end checks can test a single node.
  const starts = graph.nodes.filter((node) => startChecks.every((check) => check([node.name])));
  const reachable = endChecks.length > 0 ? canReachEnd(graph, (name) => endChecks.every((check) => check([name]))) : undefined;
  const routes = search(graph, starts.map((node) => node.name), matches, limit + 1, { reachable, maxEdges });
  const truncated = routes.length > limit;
  if (truncated) routes.pop();

  return {
    ...subgraph(graph, routes),
    routes: routes.map((route) => [...route]),
    meta: { routeCount: routes.length, truncated, limit, effectiveQuery, warnings: [...graph.warnings] },
  };
}

/** Default view: with no start Filter directly in the top-level `and`, Routes start at Entries. */
function withDefaultStart(query: Query, isStartLeaf: (member: Query) => boolean): AndQuery {
  if ('and' in query && query.and.some(isStartLeaf)) return query;
  return { and: [DEFAULT_START, ...('and' in query ? query.and : [query])] };
}

type RouteMatcher = (route: Route) => boolean;

function compile(query: Query, graph: Graph, filters: Filters, errors: ProblemError[], path: string): RouteMatcher {
  if ('and' in query) {
    const members = query.and.map((member, index) => compile(member, graph, filters, errors, `${path}.and.${index}`));
    return (route) => members.every((matches) => matches(route));
  }
  if ('or' in query) {
    const members = query.or.map((member, index) => compile(member, graph, filters, errors, `${path}.or.${index}`));
    return (route) => members.some((matches) => matches(route));
  }
  if ('not' in query) {
    const matches = compile(query.not, graph, filters, errors, `${path}.not`);
    return (route) => !matches(route);
  }
  return prepareLeaf(query, graph, filters, errors, path)?.matches ?? (() => false);
}

interface PreparedLeaf {
  filter: Filter;
  check: NodeCheck | RouteCheck;
  matches: RouteMatcher;
}

/** The leaf's Filter, check and matcher, or undefined after pushing to `errors`. */
function prepareLeaf(leaf: FilterLeaf, graph: Graph, filters: Filters, errors: ProblemError[], path: string): PreparedLeaf | undefined {
  const filter = filters.get(leaf.filter);
  if (!filter) {
    errors.push({ filter: leaf.filter, path, message: `Unknown Filter "${leaf.filter}".` });
    return undefined;
  }
  const prepared = filter.prepare(leaf.params, graph);
  if (!prepared.ok) {
    errors.push(...prepared.errors.map((error) => ({ ...error, path })));
    return undefined;
  }
  return { filter, check: prepared.check, matches: toRouteMatcher(filter, prepared.check, graph) };
}

function toRouteMatcher(filter: Filter, check: NodeCheck | RouteCheck, graph: Graph): RouteMatcher {
  if ('route' in check) return (route) => check.route(route);
  const at = (name: string | undefined) => {
    const node = name === undefined ? undefined : graph.node(name);
    return node !== undefined && check.node(node);
  };
  switch (filter.position) {
    case 'start':
      return (route) => at(route[0]);
    case 'end':
      return (route) => at(route.at(-1));
    // `route` Filters always give a RouteCheck, handled above.
    default:
      return (route) => route.some(at);
  }
}

/**
 * Pruning: the nodes with a path to a Route end (no outgoing edges) that passes `isEnd`, found by reverse BFS.
 * A Route through any other node can't match, so skipping them never changes the results.
 */
function canReachEnd(graph: Graph, isEnd: (name: string) => boolean): ReadonlySet<string> {
  const ends = graph.nodes.filter((node) => graph.successors(node.name).length === 0 && isEnd(node.name)).map((node) => node.name);
  const reached = new Set(ends);
  const queue = [...ends];
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    for (const source of graph.predecessors(name)) {
      if (reached.has(source)) continue;
      reached.add(source);
      queue.push(source);
    }
  }
  return reached;
}

interface SearchBounds {
  /** Nodes outside it are skipped. */
  reachable?: ReadonlySet<string> | undefined;
  /** Paths stop growing at this many edges. */
  maxEdges?: number;
}

/** DFS over simple paths, in source-data order, until `max` matching Routes are found. */
function search(
  graph: Graph,
  starts: readonly string[],
  matches: RouteMatcher,
  max: number,
  { reachable, maxEdges = Infinity }: SearchBounds,
): Route[] {
  const routes: Route[] = [];
  const path: string[] = [];
  const onPath = new Set<string>();
  const skip = (name: string) => onPath.has(name) || (reachable !== undefined && !reachable.has(name));

  const visit = (name: string) => {
    path.push(name);
    onPath.add(name);
    const next = graph.successors(name);
    if (next.length === 0) {
      if (path.length > 1 && matches(path)) routes.push([...path]);
    } else if (path.length - 1 < maxEdges) {
      for (const target of next) {
        if (routes.length >= max) break;
        if (!skip(target)) visit(target);
      }
    }
    onPath.delete(name);
    path.pop();
  };
  for (const start of starts) {
    if (routes.length >= max) break;
    if (!skip(start)) visit(start);
  }
  return routes;
}

/** The union of the Routes' nodes and edges, in source-data order. */
function subgraph(graph: Graph, routes: readonly Route[]): Pick<RoutesResponse, 'nodes' | 'edges'> {
  const nodeNames = new Set(routes.flat());
  const edgeIds = new Set<string>();
  for (const route of routes) {
    for (let i = 1; i < route.length; i++) {
      const edge = graph.edge(route[i - 1] ?? '', route[i] ?? '');
      if (edge) edgeIds.add(edge.id);
    }
  }
  return {
    nodes: graph.nodes.filter((node) => nodeNames.has(node.name)).map((node) => ({ id: node.name, data: node })),
    edges: graph.edges.filter((edge) => edgeIds.has(edge.id)),
  };
}
