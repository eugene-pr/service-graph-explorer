import type { FlatQuery } from '@sge/domain';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchRoutes } from '../api/client';
import { toSearchParams } from '../lib/queryString';

export function useRoutes(query: FlatQuery) {
  const queryString = toSearchParams(query);
  return useQuery({
    queryKey: ['routes', queryString.toString()],
    queryFn: () => fetchRoutes(queryString),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}
