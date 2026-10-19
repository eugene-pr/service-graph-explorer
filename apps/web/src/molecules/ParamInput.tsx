import type { ParamJsonSchema } from '@sge/domain';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';

interface ParamInputProps {
  id: string;
  name: string;
  /** The param's JSON Schema; picks the kind of input. */
  schema: ParamJsonSchema;
  required: boolean;
  /** In query-string form; lists are comma-separated. */
  value: string;
  onChange: (value: string) => void;
}

export function ParamInput({ id, name, schema, required, value, onChange }: ParamInputProps) {
  const hint = schema.type === 'array' ? 'Comma-separated' : schema.description;
  const common = { id, required, value, 'aria-describedby': hint ? `${id}-hint` : undefined } as const;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {name}
        {!required && <span className="font-normal text-slate-500"> (optional)</span>}
      </label>
      {schema.enum ? (
        <Select {...common} onChange={(e) => onChange(e.target.value)}>
          {!required && <option value="">Any</option>}
          {schema.enum.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
      ) : (
        <Input
          {...common}
          type={schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text'}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
