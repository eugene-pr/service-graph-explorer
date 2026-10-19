import type { FilterLeaf, FilterName, ProblemError, Query, RoutesResponse } from '@sge/domain';
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
  const matches = compile(effectiveQuery, graph, filters, errors);
  const startChecks = topLevelMembers(effectiveQuery)
    .filter(isStartLeaf)
    .map((leaf) => compile(leaf, graph, filters, errors));
  if (errors.length > 0) throw new QueryError(errors);

  const starts = graph.nodes.filter((node) => startChecks.every((check) => check([node.name])));
  const routes = search(graph, starts.map((node) => node.name), matches, limit + 1);
  const truncated = routes.length > limit;
  if (truncated) routes.pop();

  return {
    ...subgraph(graph, routes),
    routes: routes.map((route) => [...route]),
    meta: { routeCount: routes.length, truncated, limit, effectiveQuery, warnings: [...graph.warnings] },
  };
}

function topLevelMembers(query: Query): Query[] {
  return 'and' in query ? query.and : [];
}

/** Default view: with no start Filter directly in the top-level `and`, Routes start at Entries. */
function withDefaultStart(query: Query, isStartLeaf: (member: Query) => boolean): Query {
  if (topLevelMembers(query).some(isStartLeaf)) return query;
  return { and: [DEFAULT_START, ...('and' in query ? topLevelMembers(query) : [query])] };
}

type RouteMatcher = (route: Route) => boolean;

function compile(query: Query, graph: Graph, filters: Filters, errors: ProblemError[]): RouteMatcher {
  if ('and' in query) {
    const members = query.and.map((member) => compile(member, graph, filters, errors));
    return (route) => members.every((matches) => matches(route));
  }
  return compileLeaf(query, graph, filters, errors);
}

function compileLeaf(leaf: FilterLeaf, graph: Graph, filters: Filters, errors: ProblemError[]): RouteMatcher {
  const filter = filters.get(leaf.filter);
  if (!filter) {
    errors.push({ filter: leaf.filter, message: `Unknown Filter "${leaf.filter}".` });
    return () => false;
  }
  const prepared = filter.prepare(leaf.params, graph);
  if (!prepared.ok) {
    errors.push(...prepared.errors);
    return () => false;
  }
  return toRouteMatcher(filter, prepared.check, graph);
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

/** DFS over simple paths, in source-data order, until `max` matching Routes are found. */
function search(graph: Graph, starts: readonly string[], matches: RouteMatcher, max: number): Route[] {
  const routes: Route[] = [];
  const path: string[] = [];
  const onPath = new Set<string>();

  const visit = (name: string) => {
    path.push(name);
    onPath.add(name);
    const next = graph.successors(name);
    if (next.length === 0) {
      if (path.length > 1 && matches(path)) routes.push([...path]);
    } else {
      for (const target of next) {
        if (routes.length >= max) break;
        if (!onPath.has(target)) visit(target);
      }
    }
    onPath.delete(name);
    path.pop();
  };
  for (const start of starts) {
    if (routes.length >= max) break;
    visit(start);
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
