import { z } from 'zod';
import type { ParamJsonSchema } from './filters.js';

/** A Filter param's query-string representation, decoded before its catalog schema validates it. */
export function queryParamSchema(schema: ParamJsonSchema | undefined): z.ZodType<unknown, string> {
  switch (schema?.type) {
    case 'array':
      return z.string().transform((value) => value.split(',').map((item) => item.trim()))
        .pipe(z.array(queryParamSchema(schema.items)));
    case 'number':
    case 'integer':
      // Plain decimals only; `Number` would also accept hex, binary and exponent forms.
      return z.string().transform((value) => /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value);
    case 'boolean':
      return z.string().transform((value) => value === 'true' ? true : value === 'false' ? false : value);
    default:
      return z.string();
  }
}
