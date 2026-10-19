import type { ProblemError } from '@sge/domain';
import { useMemo } from 'react';
import { ApiError } from '../api/client';
import { Spinner } from '../atoms/Spinner';
import { useFilterCatalog } from '../hooks/useFilterCatalog';
import { useGraph } from '../hooks/useGraph';
import { DEFAULT_QUERY, useQueryState } from '../hooks/useQueryState';
import { useRoutes } from '../hooks/useRoutes';
import { highlightOf } from '../lib/highlight';
import { toSearchParams } from '../lib/queryString';
import { WarningsBanner } from '../molecules/WarningsBanner';
import { GraphCanvas } from '../organisms/GraphCanvas';
import { Legend } from '../organisms/Legend';
import { QueryPanel } from '../organisms/QueryPanel';
import { RouteList } from '../organisms/RouteList';
import { ExplorerLayout } from '../templates/ExplorerLayout';

const describeProblem = ({ filter, param, message }: ProblemError) =>
  `${[filter, param].filter(Boolean).join('.') || 'Query'}: ${message}`;

export function ExplorerPage() {
  const graph = useGraph();
  const catalog = useFilterCatalog();
  const { query, setFilters, setParams, setLimit, reset } = useQueryState();
  const routes = useRoutes(query);

  // Placeholder data is the previous Query's result: don't present it as this Query's matches.
  const current = routes.isError || routes.isPlaceholderData ? undefined : routes.data;
  const highlight = useMemo(() => current && highlightOf(current), [current]);
  const routesError = routes.error && {
    message: `Couldn't run the Query: ${routes.error.message}`,
    details: routes.error instanceof ApiError ? (routes.error.problem?.errors ?? []).map(describeProblem) : [],
  };

  return (
    <ExplorerLayout
      banner={graph.data && <WarningsBanner warnings={graph.data.meta.warnings} />}
      sidebar={
        <>
          {catalog.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Spinner /> Loading Filters…
            </p>
          ) : catalog.isError ? (
            <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              Couldn't load the Filters: {catalog.error.message}
            </p>
          ) : (
            <QueryPanel
              filters={catalog.data.filters}
              query={query}
              defaultQuery={DEFAULT_QUERY}
              onRun={(next) => {
                // Same Query: same cache key, so setting it again wouldn't refetch. Run it again explicitly.
                if (toSearchParams(next).toString() === toSearchParams(query).toString()) {
                  void routes.refetch();
                  return;
                }
                setFilters(next.filters);
                setParams(next.params);
                setLimit(next.limit);
              }}
              onReset={reset}
            />
          )}
          <Legend />
        </>
      }
      main={
        graph.isPending ? (
          <p role="status" className="flex h-full items-center justify-center gap-2 text-sm text-slate-600">
            <Spinner /> Loading graph…
          </p>
        ) : graph.isError ? (
          <p role="alert" className="m-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            Couldn't load the graph: {graph.error.message}
          </p>
        ) : (
          <GraphCanvas graph={graph.data} highlight={highlight} />
        )
      }
      aside={<RouteList
          result={routes.data}
          isPending={routes.isPending}
          isUpdating={routes.isPlaceholderData}
          error={routesError ?? undefined}
        />}
    />
  );
}
