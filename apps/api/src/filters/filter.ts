import { FilterInfo, type FilterDefinition, type FilterPosition, type GraphNode, type ProblemError } from '@sge/domain';
import { z } from 'zod';
import type { Graph } from '../graph/graph.js';

/** Node names, first to last. */
export type Route = readonly string[];

/** Checks one node: the first for `start`, the last for `end`, each for `any`. */
export interface NodeCheck {
  node(node: GraphNode): boolean;
}
/** Checks the whole Route. */
export interface RouteCheck {
  route(route: Route): boolean;
  /** No Route with more edges matches, so the search needn't go deeper. Read only from direct members of the top-level `and`. */
  maxEdges?: number;
}
type CheckFor<P extends FilterPosition> = P extends 'route' ? RouteCheck : NodeCheck;

/** Params that fit their schema but not the loaded graph, e.g. a kind that isn't present. */
export interface GraphMismatch {
  mismatches: { param: string; message: string }[];
}

/** Builds a Filter's check from its parsed params, once per Query, after checking them against the graph. */
export type FilterImplementation<D extends FilterDefinition> = (
  params: z.output<D['params']>,
  graph: Graph,
) => CheckFor<D['position']> | GraphMismatch;

/** One check per catalog entry: a missing check, or a check with no metadata, fails to compile. */
export type FilterImplementations<C extends Record<keyof C, FilterDefinition>> = { [K in keyof C]: FilterImplementation<C[K]> };

export type PreparedFilter = { ok: true; check: NodeCheck | RouteCheck } | { ok: false; errors: ProblemError[] };

/** A catalog entry paired with its check. */
export interface Filter extends FilterDefinition {
  name: string;
  /** The params schema as JSON Schema, as served by `GET /api/filters`. */
  paramsJsonSchema: FilterInfo['params'];
  /** Parses raw params against the params schema and builds the check. */
  prepare(params: unknown, graph: Graph): PreparedFilter;
}

export type Filters = ReadonlyMap<string, Filter>;

export function createFilters<C extends Record<keyof C, FilterDefinition>>(catalog: C, implementations: FilterImplementations<C>): Filters {
  // Generic in the name, so each definition stays paired with its own implementation's types.
  const pair = <K extends keyof C & string>(name: K) =>
    createFilter<C[K]['params'], C[K]['position']>(name, catalog[name], implementations[name]);
  const filters = new Map<string, Filter>();
  for (const name in catalog) filters.set(name, pair(name));
  return filters;
}

function createFilter<P extends z.ZodObject, Pos extends FilterPosition>(
  name: string,
  definition: { description: string; position: Pos; params: P },
  implementation: (params: z.output<P>, graph: Graph) => CheckFor<Pos> | GraphMismatch,
): Filter {
  return {
    name,
    ...definition,
    paramsJsonSchema: FilterInfo.shape.params.parse(z.toJSONSchema(definition.params, { io: 'input' })),
    prepare(params, graph) {
      const parsed = definition.params.safeParse(params ?? {});
      if (parsed.success) {
        const built = implementation(parsed.data, graph);
        if ('mismatches' in built) return { ok: false, errors: built.mismatches.map((mismatch) => ({ filter: name, ...mismatch })) };
        return { ok: true, check: built };
      }
      return {
        ok: false,
        errors: parsed.error.issues.flatMap((issue) => {
          // Name the param itself; a position inside it (e.g. a list item) goes in the message.
          const [key, ...inner] = issue.path;
          const keys = issue.code === 'unrecognized_keys' ? issue.keys : [key === undefined ? '' : String(key)];
          const message = inner.length > 0 ? `${issue.message} (at ${inner.join('.')})` : issue.message;
          return keys.map((param) => ({ filter: name, ...(param && { param }), message }));
        }),
      };
    },
  };
}
