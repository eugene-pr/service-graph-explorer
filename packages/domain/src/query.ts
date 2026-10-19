import { z } from 'zod';
import { GraphEdge, GraphNode } from './graph.js';

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 1000;

/** How the explorer displays Query results. Omitted in the URL for the full graph. */
export const ViewMode = z.enum(['full', 'matched']).default('full');

/** Most Routes a Query returns. Coerced, so it parses from a query string too. */
export const Limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT);

export const FilterParams = z.record(z.string(), z.unknown());
export type FilterParams = z.infer<typeof FilterParams>;

export const FilterLeaf = z.object({ filter: z.string(), params: FilterParams.optional() });
export type FilterLeaf = z.infer<typeof FilterLeaf>;

export interface AndQuery {
  and: Query[];
}
/** A Filter, or an `and` of Queries: every member must hold. */
export type Query = FilterLeaf | AndQuery;

export const AndQuery: z.ZodType<AndQuery> = z.object({ and: z.array(z.lazy(() => Query)) });
export const Query: z.ZodType<Query> = z.union([FilterLeaf, AndQuery]).meta({ id: 'Query' });

/**
 * A flat AND Query as the UI and the query string hold it.
 * Params are namespaced by Filter name and kept as strings, as in `?<filter>.<param>=<value>`.
 */
export const FlatQuery = z.object({
  filters: z.array(z.string()),
  params: z.record(z.string(), z.record(z.string(), z.string())),
  limit: Limit,
});
export type FlatQuery = z.infer<typeof FlatQuery>;

export const RoutesResponse = z.object({
  nodes: z.array(z.object({ id: z.string(), data: GraphNode })),
  edges: z.array(GraphEdge),
  /** Each Route as its node names, first to last. */
  routes: z.array(z.array(z.string())),
  meta: z.object({
    /** Routes returned; never an estimated total. */
    routeCount: z.number().int(),
    /** More Routes match than `limit`. */
    truncated: z.boolean(),
    limit: z.number().int(),
    /** The Query the engine actually ran, after defaults were added. */
    effectiveQuery: Query,
    warnings: z.array(z.string()),
  }),
});
export type RoutesResponse = z.infer<typeof RoutesResponse>;

/** One problem in a request, naming the Filter and param it concerns. */
export const ProblemError = z.object({
  filter: z.string().optional(),
  param: z.string().optional(),
  message: z.string(),
});
export type ProblemError = z.infer<typeof ProblemError>;

/** RFC 7807 problem details. */
export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  errors: z.array(ProblemError).optional(),
});
export type Problem = z.infer<typeof Problem>;
