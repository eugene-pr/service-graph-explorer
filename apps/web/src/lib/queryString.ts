import { DEFAULT_LIMIT, type FlatQuery } from '@sge/domain';

/** A flat Query in the API's query-string form: `filters=a,b&<filter>.<param>=<value>&limit=N`. */
export function toSearchParams({ filters, params, limit }: FlatQuery): URLSearchParams {
  const queryString = new URLSearchParams();
  if (filters.length > 0) queryString.set('filters', filters.join(','));
  for (const filter of filters) {
    for (const [param, value] of Object.entries(params[filter] ?? {})) {
      if (value !== '') queryString.set(`${filter}.${param}`, value);
    }
  }
  if (limit !== DEFAULT_LIMIT) queryString.set('limit', String(limit));
  return queryString;
}

/** `query` narrowed to `filter` alone, keeping its params and the limit. */
export function onlyFilter(query: FlatQuery, filter: string): FlatQuery {
  return { filters: [filter], params: { [filter]: query.params[filter] ?? {} }, limit: query.limit };
}

/**
 * `filters` with `name` turned on or off, in `order` (the Filter Catalog's names), so the same Filters always make the same Query.
 * Names not in `order` keep their place after it, and none repeats.
 */
export function withFilter(filters: readonly string[], name: string, on: boolean, order: readonly string[] = []): string[] {
  return [...new Set([...order, ...filters, name])].filter((n) => (n === name ? on : filters.includes(n)));
}
