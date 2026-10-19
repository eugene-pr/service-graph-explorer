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
