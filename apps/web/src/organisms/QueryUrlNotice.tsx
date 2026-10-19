import { useQueryUrlNotice } from '../hooks/useQueryState';

export function QueryUrlNotice() {
  const invalid = useQueryUrlNotice();
  if (!invalid) return null;
  return (
    <p role="status" className="border-b border-severity-medium bg-severity-medium-bg px-4 py-2 text-sm text-ink">
      This URL contains invalid or unknown Query values. Showing the default Query and full graph.
    </p>
  );
}
