import { z } from 'zod';

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
} satisfies FilterCatalog;

export type FilterName = keyof typeof filterCatalog;

/** The JSON Schema of one param: the parts a client needs to build an input for it. */
export const ParamJsonSchema = z.looseObject({
  type: z.string().optional(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  items: z.looseObject({ type: z.string().optional(), enum: z.array(z.string()).optional() }).optional(),
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
