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
  const errors: string[] = [];
  const searchParams = new URLSearchParams(search);
  const filters = searchParams.get('filters')?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
  const params = Object.fromEntries(filters.map((filter) => [filter, Object.fromEntries(
    [...searchParams].filter(([key]) => key.startsWith(`${filter}.`)).map(([key, value]) => [key.slice(filter.length + 1), value]),
  )]));
  const view = ViewMode.safeParse(searchParams.get('view') ?? undefined);
  const keys = [...searchParams.keys()];
  const allowed = new Set(['filters', 'limit', 'view', ...filters.flatMap((filter) =>
    Object.keys(definitions.get(filter)?.properties ?? {}).map((param) => `${filter}.${param}`),
  )]);
  const validParams = filters.every((filter) => {
    const definition = definitions.get(filter);
    if (!definition) {
      errors.push(`Unknown Filter: ${filter}.`);
      return false;
    }
    const parsed = definition.schema.safeParse(Object.fromEntries(Object.entries(params[filter] ?? {}).map(([param, value]) =>
      [param, decode(value, definition.properties?.[param])],
    )));
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((issue) => `${[filter, ...issue.path].join('.')}: ${issue.message}`));
      return false;
    }
    params[filter] = Object.fromEntries(Object.entries(parsed.data).map(([param, value]) =>
      [param, Array.isArray(value) ? value.join(',') : String(value)],
    ));
    return true;
  });
  const query = FlatQuery.safeParse({ filters, params, limit: searchParams.get('limit') ?? undefined });
  if (!query.success) errors.push(...query.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  if (!view.success) errors.push('Unknown view mode.');
  if (new Set(filters).size !== filters.length) errors.push('Each Filter can appear only once.');
  if (new Set(keys).size !== keys.length) errors.push('Each URL parameter can appear only once.');
  if (keys.some((key) => !allowed.has(key))) errors.push('Unknown URL parameter.');
  if (!query.success || !view.success || !validParams || errors.length > 0) {
    return { query: DEFAULT_QUERY, matchedOnly: false, invalid: true, errors };
  }
  return { query: query.data, matchedOnly: view.data === 'matched', invalid: false, errors };
}
