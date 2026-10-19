import { z } from 'zod';
import { Severity } from './graph.js';

/**
 * Where on a Route a Filter looks:
 * - `start`: the first node (start Filters also choose where the search begins)
 * - `end`: the last node
 * - `any`: some node on the Route
 * - `route`: the Route as a whole
 */
export const FilterPosition = z.enum(['start', 'end', 'any', 'route']);
export type FilterPosition = z.infer<typeof FilterPosition>;

export interface FilterDefinition {
  description: string;
  position: FilterPosition;
  /** Use `z.strictObject` so unknown params are rejected. */
  params: z.ZodObject;
}

/** Name → metadata for every Filter. The API pairs each entry with its check, typed against these names. */
export type FilterCatalog = Record<string, FilterDefinition>;

export const filterCatalog = {
  startsAtEntry: {
    description: 'Starts at an Entry: a node with no incoming edges. Added automatically when a Query has no start Filter.',
    position: 'start',
    params: z.strictObject({}),
  },
  startsAtPublic: {
    description: 'Starts at a publicly exposed service.',
    position: 'start',
    params: z.strictObject({}),
  },
  endsAtSink: {
    description: 'Ends at a Sink: a node whose kind counts as a Sink.',
    position: 'end',
    params: z.strictObject({
      kinds: z
        .array(z.string().min(1))
        .min(1)
        .optional()
        .meta({ description: 'Node kinds that count as Sinks. Default: every kind except service.', 'x-options': 'nodeKinds' }),
    }),
  },
  hasVulnerability: {
    description: 'Passes through a node with a vulnerability.',
    position: 'any',
    params: z.strictObject({
      minSeverity: Severity.exclude(['unknown'])
        .optional()
        .meta({ description: 'Lowest severity that counts; unknown never does. Default: any vulnerability, including unknown.' }),
    }),
  },
  passesThrough: {
    description: 'Passes through the named node.',
    position: 'any',
    params: z.strictObject({
      node: z.string().min(1).meta({ description: 'Name of a node in the graph.' }),
    }),
  },
} satisfies FilterCatalog;

export type FilterName = keyof typeof filterCatalog;

/** The JSON Schema of one param: the parts a client needs to build an input for it. */
export const ParamJsonSchema = z.looseObject({
  type: z.string().optional(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  items: z.looseObject({ type: z.string().optional(), enum: z.array(z.string()).optional() }).optional(),
  /** Where the allowed values come from when they depend on the graph: `nodeKinds` is the node kinds present. */
  'x-options': z.enum(['nodeKinds']).optional(),
});
export type ParamJsonSchema = z.infer<typeof ParamJsonSchema>;

/** A Filter Catalog entry as served by `GET /api/filters`, with params as JSON Schema. */
export const FilterInfo = z.object({
  name: z.string(),
  description: z.string(),
  position: FilterPosition,
  params: z.looseObject({
    type: z.literal('object'),
    properties: z.record(z.string(), ParamJsonSchema).optional(),
    required: z.array(z.string()).optional(),
  }),
});
export type FilterInfo = z.infer<typeof FilterInfo>;

export const FiltersResponse = z.object({ filters: z.array(FilterInfo) });
export type FiltersResponse = z.infer<typeof FiltersResponse>;
