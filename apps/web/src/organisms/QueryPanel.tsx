import { MAX_LIMIT, type FilterInfo, type FlatQuery } from '@sge/domain';
import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FilterToggle } from '../molecules/FilterToggle';
import { ParamInput } from '../molecules/ParamInput';

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
  const active = new Set(draft.filters);

  const toggle = (name: string, on: boolean) =>
    setDraft((d) => ({
      ...d,
      // Keep catalog order, so the same Filters always make the same Query.
      filters: filters.map((f) => f.name).filter((n) => (n === name ? on : d.filters.includes(n))),
    }));
  const setParam = (filter: string, param: string, value: string) =>
    setDraft((d) => ({ ...d, params: { ...d.params, [filter]: { ...d.params[filter], [param]: value } } }));

  return (
    <form
      aria-label="Query"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Send params only for Filters that are on.
        onRun({ ...draft, params: Object.fromEntries(draft.filters.map((f) => [f, draft.params[f] ?? {}])) });
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
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Run
        </Button>
        <Button
          onClick={() => {
            setDraft(defaultQuery);
            onReset();
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
