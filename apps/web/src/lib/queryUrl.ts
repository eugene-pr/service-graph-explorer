import { DEFAULT_LIMIT, FlatQuery, Limit, ViewMode } from '@sge/domain';
import { decodeParam, describeParamIssue, filterDefinitions } from './filterParams';
import { decodeTree, encodeTree, isTreeQuery, treeErrors, type ExplorerQuery } from './queryTree';

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

/** No Filters: the engine adds `startsAtEntry`, so Routes start at Entries. */
export const DEFAULT_QUERY: FlatQuery = { filters: [], params: {}, limit: DEFAULT_LIMIT };

/** The Query's URL form: the API's query string for a flat Query, or `q=<base64url tree>&limit=N` for a tree. */
export function writeQueryUrl(query: ExplorerQuery): URLSearchParams {
  if (!isTreeQuery(query)) return toSearchParams(query);
  const search = new URLSearchParams({ q: encodeTree(query.query) });
  if (query.limit !== DEFAULT_LIMIT) search.set('limit', String(query.limit));
  return search;
}

/** The Query's identity: equal identities run the same Query. */
export const queryIdentity = (query: ExplorerQuery): string => writeQueryUrl(query).toString();

/** A Query read from the URL, with the URL keys its form allows. `query` is undefined when invalid. */
interface UrlRead {
  query: ExplorerQuery | undefined;
  allowed: string[];
}

function readFlat(searchParams: URLSearchParams, errors: string[]): UrlRead {
  const filters = searchParams.get('filters')?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
  const params = Object.fromEntries(filters.map((filter) => [filter, Object.fromEntries(
    [...searchParams].filter(([key]) => key.startsWith(`${filter}.`)).map(([key, value]) => [key.slice(filter.length + 1), value]),
  )]));
  const allowed = ['filters', ...filters.flatMap((filter) =>
    Object.keys(filterDefinitions.get(filter)?.properties ?? {}).map((param) => `${filter}.${param}`),
  )];
  const validParams = filters.every((filter) => {
    const definition = filterDefinitions.get(filter);
    if (!definition) {
      errors.push(`Unknown Filter: ${filter}.`);
      return false;
    }
    const parsed = definition.schema.safeParse(Object.fromEntries(Object.entries(params[filter] ?? {}).map(([param, value]) =>
      [param, decodeParam(value, definition.properties?.[param])],
    )));
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((issue) => describeParamIssue(filter, issue)));
      return false;
    }
    params[filter] = Object.fromEntries(Object.entries(parsed.data).map(([param, value]) =>
      [param, Array.isArray(value) ? value.join(',') : String(value)],
    ));
    return true;
  });
  const query = FlatQuery.safeParse({ filters, params, limit: searchParams.get('limit') ?? undefined });
  if (!query.success) errors.push(...query.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  if (new Set(filters).size !== filters.length) errors.push('Each Filter can appear only once.');
  return { query: query.success && validParams ? query.data : undefined, allowed };
}

function readTree(searchParams: URLSearchParams, errors: string[]): UrlRead {
  const tree = decodeTree(searchParams.get('q') ?? '');
  if (!tree) errors.push('q: not a base64url-encoded Query tree.');
  else errors.push(...treeErrors(tree));
  const limit = Limit.safeParse(searchParams.get('limit') ?? undefined);
  if (!limit.success) errors.push(...limit.error.issues.map((issue) => `limit: ${issue.message}`));
  return { query: tree && limit.success ? { query: tree, limit: limit.data } : undefined, allowed: ['q'] };
}

export interface QueryUrl {
  query: ExplorerQuery;
  matchedOnly: boolean;
  /** The URL had invalid or unknown values; `query` and `matchedOnly` are the defaults. */
  invalid: boolean;
  errors: string[];
}

export function readQueryUrl(search: string): QueryUrl {
  const errors: string[] = [];
  const searchParams = new URLSearchParams(search);
  const read = (searchParams.has('q') ? readTree : readFlat)(searchParams, errors);
  const view = ViewMode.safeParse(searchParams.get('view') ?? undefined);
  const keys = [...searchParams.keys()];
  const allowed = new Set(['limit', 'view', ...read.allowed]);
  if (!view.success) errors.push('Unknown view mode.');
  if (new Set(keys).size !== keys.length) errors.push('Each URL parameter can appear only once.');
  if (keys.some((key) => !allowed.has(key))) errors.push('Unknown URL parameter.');
  if (!read.query || !view.success || errors.length > 0) {
    return { query: DEFAULT_QUERY, matchedOnly: false, invalid: true, errors };
  }
  return { query: read.query, matchedOnly: view.data === 'matched', invalid: false, errors };
}
