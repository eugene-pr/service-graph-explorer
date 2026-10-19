import type { FilterLeaf, ParamJsonSchema, ProblemError, Query } from '@sge/domain';
import { QueryError } from '../engine/findRoutes.js';
import type { Filters } from '../filters/filter.js';

/** Query-string keys that aren't Filter params. */
const RESERVED = new Set(['filters', 'limit']);

/**
 * Reads a flat AND Query from the query string: `filters=a,b` plus params namespaced as `<filter>.<param>=<value>`.
 * Values are decoded by their param's schema (lists are comma-separated); Filter names and
 * decoded values are checked by the engine.
 */
export function parseFlatQuery(queryString: Record<string, unknown>, filters: Filters): Query {
  const errors: ProblemError[] = [];
  const names = typeof queryString.filters === 'string' ? queryString.filters.split(',').map((name) => name.trim()).filter(Boolean) : [];
  const leaves = new Map<string, FilterLeaf>();
  for (const filter of names) {
    if (leaves.has(filter)) errors.push({ filter, message: `Filter "${filter}" can appear only once in the query string.` });
    leaves.set(filter, { filter });
  }

  for (const [key, value] of Object.entries(queryString)) {
    if (RESERVED.has(key)) continue;
    const dot = key.indexOf('.');
    if (dot === -1) {
      errors.push({ param: key, message: `Unknown query param "${key}"; Filter params are written as <filter>.<param>.` });
      continue;
    }
    const filter = key.slice(0, dot);
    const param = key.slice(dot + 1);
    const leaf = leaves.get(filter);
    if (!leaf) {
      errors.push({ filter, param, message: `Param "${key}" is for Filter "${filter}", which is not in \`filters\`.` });
    } else if (typeof value !== 'string') {
      errors.push({ filter, param, message: `Param "${key}" can appear only once.` });
    } else {
      const schema = filters.get(filter)?.paramsJsonSchema.properties?.[param];
      leaf.params = { ...leaf.params, [param]: decode(value, schema) };
    }
  }

  if (errors.length > 0) throw new QueryError(errors);
  return { and: [...leaves.values()] };
}

/** Turns a query-string value into its param's type. Leaves undecodable values as strings for the schema to reject. */
function decode(value: string, schema: ParamJsonSchema | undefined): unknown {
  switch (schema?.type) {
    case 'array':
      return value.split(',').map((item) => decode(item.trim(), schema.items));
    case 'number':
    case 'integer': {
      const number = Number(value);
      return value.trim() !== '' && Number.isFinite(number) ? number : value;
    }
    case 'boolean':
      return value === 'true' ? true : value === 'false' ? false : value;
    default:
      return value;
  }
}
