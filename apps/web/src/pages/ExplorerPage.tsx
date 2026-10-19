import type { FilterName, ProblemError } from '@sge/domain';
import { ApiError } from '../api/client';
import { Spinner } from '../atoms/Spinner';
import { useFilterCatalog } from '../hooks/useFilterCatalog';
import { useGraph } from '../hooks/useGraph';
import { DEFAULT_QUERY, useQueryState } from '../hooks/useQueryState';
import { useRoutes } from '../hooks/useRoutes';
import { withFilterLeaf } from '../lib/queryEdit';
import type { ExplorerQuery } from '../lib/queryTree';
import { queryIdentity } from '../lib/queryUrl';
import { WarningsBanner } from '../molecules/WarningsBanner';
import { EmptyRoutes } from '../organisms/EmptyRoutes';
import { GraphCanvas } from '../organisms/GraphCanvas';
import { Legend } from '../organisms/Legend';
import { NodeDetails } from '../organisms/NodeDetails';
import { QueryPanel } from '../organisms/QueryPanel';
import { QueryUrlNotice } from '../organisms/QueryUrlNotice';
import { RouteList } from '../organisms/RouteList';
import { useUiStore } from '../store/uiStore';
import { ExplorerLayout } from '../templates/ExplorerLayout';

const PASSES_THROUGH = 'passesThrough' satisfies FilterName;

const describeProblem = ({ filter, param, message }: ProblemError) =>
  `${[filter, param].filter(Boolean).join('.') || 'Query'}: ${message}`;

export function ExplorerPage() {
  const graph = useGraph();
  const catalog = useFilterCatalog();
  const { query, setQuery, reset, matchedOnly, setMatchedOnly } = useQueryState();
  const routes = useRoutes(query);
  const selectedNode = useUiStore((s) => s.selectedNode);
  const selectNode = useUiStore((s) => s.selectNode);
  const resetMap = useUiStore((s) => s.resetMap);
  const resetVersion = useUiStore((s) => s.resetVersion);
  const selected = selectedNode === undefined ? undefined : graph.data?.nodes.find((n) => n.id === selectedNode)?.data;
  const resetExplorer = () => {
    reset();
    resetMap();
  };

  // Placeholder data is the previous Query's result: don't present it as this Query's matches.
  const current = routes.isError || routes.isPlaceholderData ? undefined : routes.data;
  const runQuery = (next: ExplorerQuery) => {
    // Same Query: same cache key, so setting it again wouldn't refetch. Run it again explicitly.
    if (queryIdentity(next) === queryIdentity(query)) void routes.refetch();
    else setQuery(next);
  };

  const showRoutesThrough = (node: string) =>
    withFilterLeaf(query, { filter: PASSES_THROUGH, params: { node } }, catalog.data?.filters.map((f) => f.name));

  const routesError = routes.error && {
    message: `Couldn't run the Query: ${routes.error.message}`,
    details: routes.error instanceof ApiError ? (routes.error.problem?.errors ?? []).map(describeProblem) : [],
  };

  return (
    <ExplorerLayout
      banner={<>
        <QueryUrlNotice />
        {graph.data && <WarningsBanner warnings={graph.data.meta.warnings} />}
      </>}
      sidebar={
        <>
          {catalog.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner /> Loading Filters…
            </p>
          ) : catalog.isError ? (
            <p role="alert" className="rounded border border-severity-critical bg-severity-critical-bg px-3 py-2 text-sm text-ink">
              Couldn't load the Filters: {catalog.error.message}
            </p>
          ) : (
            <QueryPanel
              key={resetVersion}
              filters={catalog.data.filters}
              query={query}
              defaultQuery={DEFAULT_QUERY}
              nodeKinds={graph.data?.meta.kinds}
              effectiveQuery={current?.meta.effectiveQuery}
              onRun={runQuery}
              onReset={resetExplorer}
            />
          )}
          <Legend />
        </>
      }
      main={
        graph.isPending ? (
          <p role="status" className="flex h-full items-center justify-center gap-2 text-sm text-text-muted">
            <Spinner /> Loading graph…
          </p>
        ) : graph.isError ? (
          <p role="alert" className="m-4 rounded border border-severity-critical bg-severity-critical-bg px-4 py-3 text-sm text-ink">
            Couldn't load the graph: {graph.error.message}
          </p>
        ) : (
          <GraphCanvas
            graph={graph.data}
            result={current}
            matchedOnly={matchedOnly}
            onMatchedOnlyChange={setMatchedOnly}
            selectedNode={selectedNode}
            onSelectNode={selectNode}
            onReset={resetExplorer}
          />
        )
      }
      aside={<RouteList
          result={routes.data}
          isPending={routes.isPending}
          isUpdating={routes.isPlaceholderData}
          error={routesError ?? undefined}
          emptyState={<EmptyRoutes query={query} onApply={runQuery} />}
        />}
      bottom={
        selected && (
          <NodeDetails
            node={selected}
            onClose={() => selectNode(undefined)}
            onShowRoutesThrough={() => runQuery(showRoutesThrough(selected.name))}
          />
        )
      }
    />
  );
}
