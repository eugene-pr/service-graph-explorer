import { Limit, Query } from '@sge/domain';
import { createJsonSchemaTransform, createJsonSchemaTransformObject } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Filters } from '../filters/filter.js';

/** Catalog-specific documentation; runtime validation keeps its detailed Filter errors. */
export function routeDocs(filters: Filters) {
  // Each app owns its catalog and registry, so fixture or future catalogs cannot leak between docs.
  const schemaRegistry = z.registry<{ id?: string | undefined; [key: string]: unknown }>();
  const entries = [...filters.values()];
  const leaves = entries.map(({ name, description, params }) => z.strictObject({
    filter: z.literal(name),
    params: params.safeParse({}).success ? params.optional() : params,
  }).register(schemaRegistry, { description }));
  const tree: z.ZodType<Query> = z.lazy(() => z.union([
    ...leaves,
    z.strictObject({ and: z.array(tree) }),
    z.strictObject({ or: z.array(tree) }),
    z.strictObject({ not: tree }),
  ]));
  schemaRegistry.add(Query, { id: 'Query' });
  schemaRegistry.add(tree, { id: 'FilterQuery' });
  const transform = createJsonSchemaTransform({ schemaRegistry });
  const querystring = z.looseObject({
    filters: z.string().optional().register(schemaRegistry, {
      description: `Comma-separated Filter names, all of which must hold. Available: ${entries.map(({ name }) => name).join(', ')}.`,
    }),
    limit: Limit.register(schemaRegistry, { description: 'Most Routes to return.' }),
    ...Object.fromEntries(entries.flatMap(({ name, params }) => {
      const properties: Record<string, z.ZodType> = params.shape;
      return Object.entries(properties).map(([param, schema]) => {
        schemaRegistry.add(schema, schema.meta() ?? {});
        return [
          `${name}.${param}`,
          schema.optional().register(schemaRegistry, {
            ...schema.meta(),
            description: `${schema.description ?? param} Used when ${name} is in filters.`,
          }),
        ];
      });
    })),
  }).register(schemaRegistry, { style: 'form', explode: false });
  const body = z.object({ query: tree, limit: Limit });

  return {
    transform: (context: Parameters<typeof transform>[0]) => transform({
      ...context,
      schema: {
        ...context.schema,
        ...(context.url === '/api/routes' && { querystring }),
        ...(context.url === '/api/routes/query' && { body }),
      },
    }),
    transformObject: createJsonSchemaTransformObject({ schemaRegistry }),
  };
}
