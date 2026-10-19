import type { FilterInfo, ParamJsonSchema } from '@sge/domain';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Toggle } from '../atoms/Toggle';

interface ParamInputProps {
  id: string;
  name: string;
  /** The param's JSON Schema; picks the kind of input. */
  schema: ParamJsonSchema;
  required: boolean;
  /** In query-string form; lists are comma-separated. */
  value: string;
  onChange: (value: string) => void;
  /** Allowed values of a list param; shown as a checkbox per value. */
  options?: readonly string[] | undefined;
}

export function ParamInput({ id, name, schema, required, value, onChange, options }: ParamInputProps) {
  if (schema.type === 'array' && options) {
    return <ParamCheckboxes id={id} name={name} description={schema.description} value={value} onChange={onChange} options={options} />;
  }

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

interface ParamInputsProps {
  /** Each input's id is `<idPrefix>-<param>`. */
  idPrefix: string;
  /** A Filter's params, as the Filter Catalog serves them; one input per param. */
  params: FilterInfo['params'];
  /** Values in query-string form; a missing param is empty. */
  values: Readonly<Record<string, string>>;
  onChange: (param: string, value: string) => void;
  /** The node kinds in the graph, for params whose values are node kinds. */
  nodeKinds: readonly string[] | undefined;
  className?: string;
}

/** An input for each of a Filter's params; nothing for a Filter without params. */
export function ParamInputs({ idPrefix, params, values, onChange, nodeKinds, className = '' }: ParamInputsProps) {
  const properties = Object.entries(params.properties ?? {});
  if (properties.length === 0) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {properties.map(([param, schema]) => (
        <ParamInput
          key={param}
          id={`${idPrefix}-${param}`}
          name={param}
          schema={schema}
          required={params.required?.includes(param) ?? false}
          value={values[param] ?? ''}
          onChange={(value) => onChange(param, value)}
          options={schema['x-options'] === 'nodeKinds' ? nodeKinds : undefined}
        />
      ))}
    </div>
  );
}

interface ParamCheckboxesProps {
  id: string;
  name: string;
  description: string | undefined;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}

/** An optional list param: none checked sends nothing, so the API's default applies. */
function ParamCheckboxes({ id, name, description, value, onChange, options }: ParamCheckboxesProps) {
  const checked = new Set(value.split(',').filter(Boolean));
  const toggle = (option: string, on: boolean) =>
    // Keep option order, so the same choice always makes the same Query.
    onChange(options.filter((o) => (o === option ? on : checked.has(o))).join(','));

  return (
    <fieldset className="space-y-1" aria-describedby={description ? `${id}-hint` : undefined}>
      <legend className="text-xs font-medium text-slate-700">
        {name}
        <span className="font-normal text-slate-500"> (optional)</span>
      </legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 font-mono text-xs text-slate-800">
            <Toggle checked={checked.has(option)} onChange={(e) => toggle(option, e.target.checked)} />
            {option}
          </label>
        ))}
      </div>
      {description && (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {description} None checked: the default.
        </p>
      )}
    </fieldset>
  );
}
