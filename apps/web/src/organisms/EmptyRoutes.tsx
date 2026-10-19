import type { FlatQuery } from '@sge/domain';
import { useQueries } from '@tanstack/react-query';
import { Button } from '../atoms/Button';
import { routesQueryOptions } from '../hooks/useRoutes';

interface EmptyRoutesProps {
  query: FlatQuery;
  onApply: (query: FlatQuery) => void;
}

/** Mounted only for the current Query's empty result. Counts share the Route cache. */
export function EmptyRoutes({ query, onApply }: EmptyRoutesProps) {
  const singleFilterQueries = query.filters.map((filter) => ({
    filters: [filter],
    params: { [filter]: query.params[filter] ?? {} },
    limit: query.limit,
  }));
  const counts = useQueries({ queries: singleFilterQueries.map(routesQueryOptions) });

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
      <p className="font-medium text-slate-900">No Routes match this Query.</p>
      {query.filters.length > 0 ? (
        <>
          <p className="text-slate-600">Try removing a Filter. Choose a Filter below to apply just that one with its current parameters.</p>
          <ul className="space-y-2">
            {singleFilterQueries.map((single, index) => {
              const count = counts[index]!;
              return (
                <li key={query.filters[index]}>
                  <Button className="w-full text-left" onClick={() => onApply(single)}>
                    {query.filters[index]} only:{' '}
                    {count.isError ? "Count unavailable" : !count.data ? 'Counting Routes…' : (
                      <>{count.data.meta.truncated && 'At least '}{count.data.meta.routeCount} {count.data.meta.routeCount === 1 ? 'Route' : 'Routes'}</>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-slate-600">There are no Routes from Entries in this graph. Try choosing a start Filter to explore other starting nodes.</p>
      )}
    </div>
  );
}
