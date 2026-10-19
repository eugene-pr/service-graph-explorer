import type { RoutesResponse } from '@sge/domain';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '../atoms/Spinner';
import { RouteChip } from '../molecules/RouteChip';
import { formatRouteCount } from '../lib/routeCount';
import { routeKey } from '../lib/toFlowGraph';
import { useUiStore } from '../store/uiStore';

interface RouteListProps {
  result: RoutesResponse | undefined;
  isPending: boolean;
  /** `result` is from the previous Query while this one runs. */
  isUpdating?: boolean;
  error?: { message: string; details: readonly string[] } | undefined;
  emptyState?: ReactNode;
}

export function RouteList({ result, isPending, isUpdating = false, error, emptyState }: RouteListProps) {
  const hoverRoute = useUiStore((s) => s.hoverRoute);
  const selectedRoute = useUiStore((s) => s.selectedRoute);
  const selectRoute = useUiStore((s) => s.selectRoute);
  const clearRouteHighlight = useUiStore((s) => s.clearRouteHighlight);
  const selectedIndex = result?.routes.findIndex((route) => routeKey(route) === selectedRoute) ?? -1;

  useEffect(() => {
    // Removing a row does not fire mouseleave. Read the hover without subscribing the list to previews.
    const hoveredRoute = useUiStore.getState().hoveredRoute;
    const rowIsVisible = !error && !isPending && result?.routes.some((route) => routeKey(route) === hoveredRoute);
    if (hoveredRoute && !rowIsVisible) hoverRoute(undefined);
  }, [result, error, isPending, hoverRoute]);

  useEffect(() => () => hoverRoute(undefined), [hoverRoute]);

  return (
    <section aria-labelledby="route-list-title" className="space-y-3 text-sm">
      <h2 id="route-list-title" className="font-semibold text-ink">
        Routes
      </h2>
      <p id="route-list-help" className="text-xs text-text-muted">
        Hover to preview. Click or use arrow keys and Enter to select. Escape clears the highlight.
      </p>
      {error ? (
        <div role="alert" className="rounded border border-severity-critical bg-severity-critical-bg px-3 py-2 text-ink">
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
        <p role="status" className="flex items-center gap-2 text-text-muted">
          <Spinner /> Finding Routes…
        </p>
      ) : (
        <>
          {isUpdating && (
            <p role="status" className="flex items-center gap-2 text-text-muted">
              <Spinner /> Updating Routes for the new Query…
            </p>
          )}
          <p className="text-text-muted">
            {formatRouteCount(result.meta.routeCount)}
          </p>
          {result.meta.truncated && (
            <p role="status" className="rounded border border-severity-medium bg-severity-medium-bg px-3 py-2 text-ink">
              Showing the first {result.meta.limit}. More Routes match; narrow the Query or raise the limit.
            </p>
          )}
          {result.meta.routeCount === 0 && !isUpdating && emptyState}
          <ol
            aria-busy={isUpdating}
            aria-describedby="route-list-help"
            className={`space-y-2 transition-opacity ${isUpdating ? 'opacity-50' : ''}`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clearRouteHighlight();
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const buttons = [...event.currentTarget.querySelectorAll('button')];
                const index = buttons.findIndex((button) => button === document.activeElement);
                const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                const route = result.routes[next];
                if (route) {
                  buttons[next]?.focus();
                  selectRoute(routeKey(route));
                }
              }
            }}
          >
            {result.routes.map((route, index) => (
              <li key={routeKey(route)}>
                <button
                  type="button"
                  aria-label={`Route: ${route.join(' → ')}`}
                  aria-pressed={selectedRoute === routeKey(route)}
                  tabIndex={index === Math.max(0, selectedIndex) ? 0 : -1}
                  onClick={() => selectRoute(routeKey(route))}
                  onMouseEnter={() => hoverRoute(routeKey(route))}
                  onMouseLeave={() => hoverRoute(undefined)}
                  className={`w-full rounded border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${selectedRoute === routeKey(route) ? 'border-accent bg-accent-soft' : 'border-border bg-white'}`}
                >
                  <RouteChip route={route} />
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
