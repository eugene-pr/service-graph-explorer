import { useHealth } from '../hooks/useHealth';

export function ExplorerPage() {
  const health = useHealth();

  const status = health.isPending ? 'checking…' : health.isError ? 'unreachable' : health.data.status;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <p role="status" className="rounded border border-slate-200 bg-white px-4 py-2 font-mono text-sm">
        API: {status}
      </p>
    </main>
  );
}
