import type { FlatQuery } from '@sge/domain';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { fetchRoutes, postRoutesQuery } from '../api/client';
import { isTreeQuery, type ExplorerQuery } from '../lib/queryTree';
import { onlyFilter } from '../lib/queryEdit';
import { queryIdentity, toSearchParams } from '../lib/queryUrl';

/** Flat Queries use `GET /api/routes`; trees use `POST /api/routes/query`. Both are cached by their URL form. */
export function routesQueryOptions(query: ExplorerQuery) {
  return queryOptions({
    queryKey: ['routes', queryIdentity(query)],
    queryFn: () => (isTreeQuery(query) ? postRoutesQuery(query) : fetchRoutes(toSearchParams(query))),
    staleTime: Infinity,
  });
}

export function useRoutes(query: ExplorerQuery) {
  return useQuery({ ...routesQueryOptions(query), placeholderData: keepPreviousData });
}

/** Routes for `filter` alone from `query`, through the shared Route cache. */
export function useFilterRoutes(query: FlatQuery, filter: string) {
  return useQuery(routesQueryOptions(onlyFilter(query, filter)));
}
