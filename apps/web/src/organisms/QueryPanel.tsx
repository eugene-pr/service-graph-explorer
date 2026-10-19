import { MAX_LIMIT, type FilterInfo, type FlatQuery, type Query } from '@sge/domain';
import { useState } from 'react';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Toggle } from '../atoms/Toggle';
import { FilterToggle } from '../molecules/FilterToggle';
import { ParamInputs } from '../molecules/ParamInput';
import { withFilter } from '../lib/queryString';
import { isTreeQuery, toTree, type ExplorerQuery } from '../lib/queryTree';
import { readQueryUrl, writeQueryUrl } from '../lib/queryUrl';
import { QueryTreeBuilder } from './QueryTreeBuilder';

interface QueryPanelProps {
  /** The Filter Catalog; the panel is generated from it. */
  filters: readonly FilterInfo[];
  /** The Query that last ran; the panel starts from it, in advanced mode for a tree. */
  query: ExplorerQuery;
  /** What reset returns to. */
  defaultQuery: FlatQuery;
  /** The node kinds in the graph, for params whose values are node kinds; undefined until the graph loads. */
  nodeKinds: readonly string[] | undefined;
  /** The Query the engine last ran, with its defaults added; shown in advanced mode. */
  effectiveQuery: Query | undefined;
  onRun: (query: ExplorerQuery) => void;
  onReset: () => void;
}

/** The flat draft (which also holds the limit) and the tree draft for a Query. */
const draftsFor = (query: ExplorerQuery, defaultQuery: FlatQuery) =>
  isTreeQuery(query)
    ? { draft: { ...defaultQuery, limit: query.limit }, tree: query.query }
    : { draft: query, tree: toTree(query) };

/** Edits a draft Query, as a flat Filter list or, in advanced mode, a tree; nothing runs until Run. */
export function QueryPanel({ filters, query, defaultQuery, nodeKinds, effectiveQuery, onRun, onReset }: QueryPanelProps) {
  const [initial] = useState(() => draftsFor(query, defaultQuery));
  const [draft, setDraft] = useState(initial.draft);
  const [tree, setTree] = useState(initial.tree);
  // The flat draft the tree was built from: switching to advanced rebuilds the tree only after flat edits, so tree edits survive a round trip.
  const [treeSource, setTreeSource] = useState(initial.draft);
  const [advanced, setAdvanced] = useState(isTreeQuery(query));
  const [errors, setErrors] = useState<string[]>([]);
  // A new Query, run from here or set from outside (e.g. "Show Routes through here"), replaces the drafts.
  const [shown, setShown] = useState(query);
  if (query !== shown) {
    const drafts = draftsFor(query, defaultQuery);
    setShown(query);
    setDraft(drafts.draft);
    setTree(drafts.tree);
    setTreeSource(drafts.draft);
    setAdvanced(isTreeQuery(query));
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
        // Validate through the URL form, which also drops params of Filters that are off.
        const next = readQueryUrl(writeQueryUrl(advanced ? { query: tree, limit: draft.limit } : draft).toString());
        setErrors(next.errors);
        if (!next.invalid) onRun(next.query);
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Query</h2>
        <label className="flex items-center gap-2 text-sm">
          <Toggle
            checked={advanced}
            aria-describedby="query-advanced-hint"
            onChange={(e) => {
              // The current flat Filters become the tree's starting point.
              if (e.target.checked && draft !== treeSource) {
                setTree(toTree(draft));
                setTreeSource(draft);
              }
              setAdvanced(e.target.checked);
              setErrors([]);
            }}
          />
          Advanced
        </label>
      </div>
      <p id="query-advanced-hint" className="sr-only">
        Build the Query as a tree of AND, OR and NOT groups.
      </p>
      {advanced ? (
        <QueryTreeBuilder filters={filters} tree={tree} onChange={setTree} nodeKinds={nodeKinds} />
      ) : (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs text-slate-600">Routes must match every Filter that is on.</legend>
          {filters.map(({ name, description, params }) => (
            <FilterToggle key={name} name={name} description={description} checked={active.has(name)} onChange={(on) => toggle(name, on)}>
              <ParamInputs
                className="ml-6"
                idPrefix={`param-${name}`}
                params={params}
                values={draft.params[name] ?? {}}
                onChange={(param, value) => setParam(name, param, value)}
                nodeKinds={nodeKinds}
              />
            </FilterToggle>
          ))}
        </fieldset>
      )}
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
            setAdvanced(false);
            setErrors([]);
            onReset();
          }}
        >
          Reset
        </Button>
      </div>
      {advanced && effectiveQuery && (
        <section aria-labelledby="effective-query-heading" className="space-y-1">
          <h3 id="effective-query-heading" className="text-xs font-medium text-slate-700">
            Effective Query
          </h3>
          <p className="text-xs text-slate-500">What the engine last ran, including any default it added.</p>
          <pre tabIndex={0} className="max-h-48 overflow-auto rounded bg-slate-100 p-2 font-mono text-xs text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600">
            {JSON.stringify(effectiveQuery, null, 2)}
          </pre>
        </section>
      )}
    </form>
  );
}
