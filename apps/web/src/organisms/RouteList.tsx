import type { RoutesResponse } from '@sge/domain';
import { Spinner } from '../atoms/Spinner';
import { RouteChip } from '../molecules/RouteChip';

interface RouteListProps {
  result: RoutesResponse | undefined;
  isPending: boolean;
  /** `result` is from the previous Query while this one runs. */
  isUpdating?: boolean;
  error?: { message: string; details: readonly string[] } | undefined;
}

export function RouteList({ result, isPending, isUpdating = false, error }: RouteListProps) {
  return (
    <section aria-labelledby="route-list-title" className="space-y-3 text-sm">
      <h2 id="route-list-title" className="font-semibold text-slate-900">
        Routes
      </h2>
      {error ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
          <p>{error.message}</p>
          {error.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      ) : isPending || !result ? (
        <p role="status" className="flex items-center gap-2 text-slate-600">
          <Spinner /> Finding Routes…
        </p>
      ) : (
        <>
          {isUpdating && (
            <p role="status" className="flex items-center gap-2 text-slate-600">
              <Spinner /> Updating Routes for the new Query…
            </p>
          )}
          <p className="text-slate-700">
            {result.meta.routeCount} {result.meta.routeCount === 1 ? 'Route' : 'Routes'}
          </p>
          {result.meta.truncated && (
            <p role="status" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              Showing the first {result.meta.limit}. More Routes match; narrow the Query or raise the limit.
            </p>
          )}
          <ol aria-busy={isUpdating} className={`space-y-2 transition-opacity ${isUpdating ? 'opacity-50' : ''}`}>
            {result.routes.map((route) => (
              <li key={route.join('\u0000')} className="rounded border border-slate-200 bg-white p-2">
                <RouteChip route={route} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
