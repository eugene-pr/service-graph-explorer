import { DEFAULT_LIMIT, filterCatalog, FilterInfo, FlatQuery, ViewMode, type ParamJsonSchema } from '@sge/domain';

/** No Filters: the engine adds `startsAtEntry`, so Routes start at Entries. */
export const DEFAULT_QUERY: FlatQuery = { filters: [], params: {}, limit: DEFAULT_LIMIT };

const definitions = new Map(Object.entries(filterCatalog).map(([name, definition]) => [name, {
  schema: definition.params,
  properties: FilterInfo.shape.params.parse(definition.params.toJSONSchema({ io: 'input' })).properties,
}]));

function decode(value: string, schema: ParamJsonSchema | undefined): unknown {
  switch (schema?.type) {
    case 'array': return value.split(',').map((item) => decode(item.trim(), schema.items));
    case 'number':
    case 'integer': return value.trim() === '' ? value : Number(value);
    default: return value;
  }
}

export function readQueryUrl(search: string) {
  const searchParams = new URLSearchParams(search);
  const filters = searchParams.get('filters')?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
  const params = Object.fromEntries(filters.map((filter) => [filter, Object.fromEntries(
    [...searchParams].filter(([key]) => key.startsWith(`${filter}.`)).map(([key, value]) => [key.slice(filter.length + 1), value]),
  )]));
  const query = FlatQuery.safeParse({ filters, params, limit: searchParams.get('limit') ?? undefined });
  const view = ViewMode.safeParse(searchParams.get('view') ?? undefined);
  const keys = [...searchParams.keys()];
  const allowed = new Set(['filters', 'limit', 'view', ...filters.flatMap((filter) =>
    Object.keys(definitions.get(filter)?.properties ?? {}).map((param) => `${filter}.${param}`),
  )]);
  const validParams = filters.every((filter) => {
    const definition = definitions.get(filter);
    return definition?.schema.safeParse(Object.fromEntries(Object.entries(params[filter] ?? {}).map(([param, value]) =>
      [param, decode(value, definition.properties?.[param])],
    ))).success;
  });
  const invalid = !query.success || !view.success || !validParams || new Set(filters).size !== filters.length
    || new Set(keys).size !== keys.length || keys.some((key) => !allowed.has(key));
  if (invalid || !query.success || !view.success) return { query: DEFAULT_QUERY, matchedOnly: false, invalid: true };
  return { query: query.data, matchedOnly: view.data === 'matched', invalid: false };
}
