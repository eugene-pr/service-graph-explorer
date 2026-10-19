import { useQuery } from '@tanstack/react-query';
import { fetchFilters } from '../api/client';

export function useFilterCatalog() {
  return useQuery({ queryKey: ['filters'], queryFn: fetchFilters, staleTime: Infinity });
}
