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
}
type CheckFor<P extends FilterPosition> = P extends 'route' ? RouteCheck : NodeCheck;

/** Builds a Filter's check from its parsed params, once per Query. */
export type FilterImplementation<D extends FilterDefinition> = (
  params: z.output<D['params']>,
  graph: Graph,
) => CheckFor<D['position']>;

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
  implementation: (params: z.output<P>, graph: Graph) => CheckFor<Pos>,
): Filter {
  return {
    name,
    ...definition,
    paramsJsonSchema: FilterInfo.shape.params.parse(z.toJSONSchema(definition.params, { io: 'input' })),
    prepare(params, graph) {
      const parsed = definition.params.safeParse(params ?? {});
      if (parsed.success) return { ok: true, check: implementation(parsed.data, graph) };
      return {
        ok: false,
        errors: parsed.error.issues.flatMap((issue) => {
          const keys = issue.code === 'unrecognized_keys' ? issue.keys : [issue.path.join('.')];
          return keys.map((param) => ({ filter: name, ...(param && { param }), message: issue.message }));
        }),
      };
    },
  };
}
