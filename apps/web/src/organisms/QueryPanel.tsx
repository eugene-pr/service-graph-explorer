import { MAX_LIMIT, type FilterInfo, type FlatQuery } from '@sge/domain';
import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FilterToggle } from '../molecules/FilterToggle';
import { ParamInput } from '../molecules/ParamInput';
import { readQueryUrl } from '../lib/queryUrl';
import { toSearchParams, withFilter } from '../lib/queryString';

interface QueryPanelProps {
  /** The Filter Catalog; the panel is generated from it. */
  filters: readonly FilterInfo[];
  /** The Query that last ran; the panel starts from it. */
  query: FlatQuery;
  /** What reset returns to. */
  defaultQuery: FlatQuery;
  /** The node kinds in the graph, for params whose values are node kinds; undefined until the graph loads. */
  nodeKinds: readonly string[] | undefined;
  onRun: (query: FlatQuery) => void;
  onReset: () => void;
}

/** Edits a draft Query; nothing runs until Run. */
export function QueryPanel({ filters, query, defaultQuery, nodeKinds, onRun, onReset }: QueryPanelProps) {
  const [draft, setDraft] = useState(query);
  const [errors, setErrors] = useState<string[]>([]);
  // A new Query, run from here or set from outside (e.g. "Show Routes through here"), replaces the draft.
  const [shown, setShown] = useState(query);
  if (query !== shown) {
    setShown(query);
    setDraft(query);
    setErrors([]);
  }
  const active = new Set(draft.filters);

  const toggle = (name: string, on: boolean) =>
    setDraft((d) => ({ ...d, filters: withFilter(d.filters, name, on, filters.map((f) => f.name)) }));
  const setParam = (filter: string, param: string, value: string) =>
    setDraft((d) => ({ ...d, params: { ...d.params, [filter]: { ...d.params[filter], [param]: value } } }));

  return (
    <form
      aria-label="Query"
      className="space-y-4"
      onChange={() => setErrors([])}
      onSubmit={(e) => {
        e.preventDefault();
        // Send params only for Filters that are on.
        const next = readQueryUrl(toSearchParams(draft).toString());
        setErrors(next.errors);
        if (!next.invalid) onRun(next.query);
      }}
    >
      <h2 className="font-semibold text-slate-900">Query</h2>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs text-slate-600">Routes must match every Filter that is on.</legend>
        {filters.map(({ name, description, params }) => (
          <FilterToggle key={name} name={name} description={description} checked={active.has(name)} onChange={(on) => toggle(name, on)}>
            {Object.keys(params.properties ?? {}).length > 0 && (
              <div className="ml-6 space-y-2">
                {Object.entries(params.properties ?? {}).map(([param, schema]) => (
                  <ParamInput
                    key={param}
                    id={`param-${name}-${param}`}
                    name={param}
                    schema={schema}
                    required={params.required?.includes(param) ?? false}
                    value={draft.params[name]?.[param] ?? ''}
                    onChange={(value) => setParam(name, param, value)}
                    options={schema['x-options'] === 'nodeKinds' ? nodeKinds : undefined}
                  />
                ))}
              </div>
            )}
          </FilterToggle>
        ))}
      </fieldset>
      <div className="space-y-1">
        <label htmlFor="query-limit" className="block text-xs font-medium text-slate-700">
          Limit
        </label>
        <Input
          id="query-limit"
          type="number"
          min={1}
          max={MAX_LIMIT}
          required
          value={draft.limit}
          onChange={(e) => {
            const limit = e.target.valueAsNumber;
            if (!Number.isNaN(limit)) setDraft((d) => ({ ...d, limit }));
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded border border-red-300 bg-red-50 px-6 py-2 text-sm text-red-900">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Run
        </Button>
        <Button
          onClick={() => {
            setDraft(defaultQuery);
            setErrors([]);
            onReset();
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
