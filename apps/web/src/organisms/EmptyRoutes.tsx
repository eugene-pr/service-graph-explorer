import type { FlatQuery } from '@sge/domain';
import { Button } from '../atoms/Button';
import { useFilterCatalog } from '../hooks/useFilterCatalog';
import { useFilterRoutes } from '../hooks/useRoutes';
import { isTreeQuery, type ExplorerQuery } from '../lib/queryTree';
import { onlyFilter } from '../lib/queryUrl';
import { formatRouteCount } from '../lib/routeCount';

interface EmptyRoutesProps {
  query: ExplorerQuery;
  onApply: (query: FlatQuery) => void;
}

/** Mounted only for the current Query's empty result. Hints mount together, so their counts load in parallel. */
export function EmptyRoutes({ query, onApply }: EmptyRoutesProps) {
  return (
    <div className="space-y-3 rounded border border-border bg-surface p-3">
      <p className="font-medium text-ink">No Routes match this Query.</p>
      {isTreeQuery(query) ? (
        <p className="text-text-muted">Try removing a member of the tree, or changing an AND group to OR. Check the effective Query for a default start Filter.</p>
      ) : query.filters.length > 1 ? (
        <>
          <p className="text-text-muted">Try removing a Filter. Choose a Filter below to apply just that one with its current parameters.</p>
          <ul className="space-y-2">
            {query.filters.map((filter) => (
              <li key={filter}>
                <FilterHint query={query} filter={filter} onApply={onApply} />
              </li>
            ))}
          </ul>
        </>
      ) : query.filters.length === 1 ? (
        <p className="text-text-muted">Try changing this Filter's parameters or removing it.</p>
      ) : (
        <p className="text-text-muted">There are no Routes from Entries in this graph. Try choosing a start-position Filter to explore other starting nodes.</p>
      )}
    </div>
  );
}

interface FilterHintProps {
  query: FlatQuery;
  filter: string;
  onApply: (query: FlatQuery) => void;
}

function FilterHint({ query, filter, onApply }: FilterHintProps) {
  const routes = useFilterRoutes(query, filter);
  const catalog = useFilterCatalog();
  // Without a start-position Filter, the engine only searches from Entries.
  const position = catalog.data?.filters.find((info) => info.name === filter)?.position;
  const fromEntries = position !== undefined && position !== 'start';

  const countLabel = () => {
    if (routes.isError) return 'Count unavailable';
    if (!routes.data) return 'Counting Routes…';
    const { truncated, routeCount } = routes.data.meta;
    return `${truncated ? 'At least ' : ''}${formatRouteCount(routeCount)}`;
  };

  return (
    <Button className="w-full text-left" onClick={() => onApply(onlyFilter(query, filter))}>
      {filter} only{fromEntries && ', from Entries'}: {countLabel()}
    </Button>
  );
}
