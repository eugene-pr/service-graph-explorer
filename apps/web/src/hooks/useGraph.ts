import { useQuery } from '@tanstack/react-query';
import { fetchGraph } from '../api/client';

export function useGraph() {
  return useQuery({ queryKey: ['graph'], queryFn: fetchGraph, staleTime: Infinity });
}
