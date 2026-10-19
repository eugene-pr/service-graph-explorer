import { Spinner } from '../atoms/Spinner';
import { useGraph } from '../hooks/useGraph';
import { WarningsBanner } from '../molecules/WarningsBanner';
import { GraphCanvas } from '../organisms/GraphCanvas';
import { Legend } from '../organisms/Legend';
import { ExplorerLayout } from '../templates/ExplorerLayout';

export function ExplorerPage() {
  const graph = useGraph();

  return (
    <ExplorerLayout
      banner={graph.data && <WarningsBanner warnings={graph.data.meta.warnings} />}
      sidebar={<Legend />}
      main={
        graph.isPending ? (
          <p role="status" className="flex h-full items-center justify-center gap-2 text-sm text-slate-600">
            <Spinner /> Loading graph…
          </p>
        ) : graph.isError ? (
          <p role="alert" className="m-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            Couldn't load the graph: {graph.error.message}
          </p>
        ) : (
          <GraphCanvas graph={graph.data} />
        )
      }
    />
  );
}
