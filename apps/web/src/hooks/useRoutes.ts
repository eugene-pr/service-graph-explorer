import type { FlatQuery } from '@sge/domain';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { fetchRoutes } from '../api/client';
import { toSearchParams } from '../lib/queryString';

export function routesQueryOptions(query: FlatQuery) {
  const queryString = toSearchParams(query);
  return queryOptions({
    queryKey: ['routes', queryString.toString()],
    queryFn: () => fetchRoutes(queryString),
    staleTime: Infinity,
  });
}

export function useRoutes(query: FlatQuery) {
  return useQuery({ ...routesQueryOptions(query), placeholderData: keepPreviousData });
}
