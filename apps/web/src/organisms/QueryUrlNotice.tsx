import { useQueryUrlNotice } from '../hooks/useQueryState';

export function QueryUrlNotice() {
  const invalid = useQueryUrlNotice();
  if (!invalid) return null;
  return (
    <p role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      This URL contains invalid or unknown Query values. Showing the default Query and full graph.
    </p>
  );
}
