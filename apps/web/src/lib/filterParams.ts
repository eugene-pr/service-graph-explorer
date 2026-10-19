import { filterCatalog, FilterInfo, type ParamJsonSchema } from '@sge/domain';

/** Each Filter's params schema, and its params as JSON Schema for decoding input strings. */
export const filterDefinitions = new Map(Object.entries(filterCatalog).map(([name, definition]) => [name, {
  schema: definition.params,
  properties: FilterInfo.shape.params.parse(definition.params.toJSONSchema({ io: 'input' })).properties,
}]));

/** A param value from its query-string form: lists are comma-separated, numbers are parsed. */
export function decodeParam(value: string, schema: ParamJsonSchema | undefined): unknown {
  switch (schema?.type) {
    case 'array': return value.split(',').map((item) => decodeParam(item.trim(), schema.items));
    case 'number':
    case 'integer': return value.trim() === '' ? value : Number(value);
    default: return value;
  }
}

/** A param value in query-string form; the inverse of `decodeParam`. */
export function encodeParam(value: unknown): string {
  if (Array.isArray(value)) return value.map(encodeParam).join(',');
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

/** A params schema issue as `<filter>.<param>: <message>`. */
export const describeParamIssue = (filter: string, issue: { path: readonly PropertyKey[]; message: string }) =>
  `${[filter, ...issue.path.map(String)].join('.')}: ${issue.message}`;
