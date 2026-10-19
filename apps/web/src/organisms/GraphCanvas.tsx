import type { GraphResponse, RoutesResponse } from '@sge/domain';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import { selectionAfter, toFlowGraph } from '../lib/toFlowGraph';
import { useUiStore } from '../store/uiStore';
import { ServiceNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };

interface GraphCanvasProps {
  graph: GraphResponse;
  /** Only the current Query result; absent while a new Query runs. */
  result: RoutesResponse | undefined;
  matchedOnly: boolean;
  /** Name of the selected node. */
  selectedNode?: string | undefined;
  onSelectNode: (name: string | undefined) => void;
}

export function GraphCanvas({ graph, result, matchedOnly, selectedNode, onSelectNode }: GraphCanvasProps) {
  const hoveredRoute = useUiStore((s) => s.hoveredRoute);
  const selectedRoute = useUiStore((s) => s.selectedRoute);
  const { nodes, edges } = useMemo(
    () => toFlowGraph(graph, result, { hoveredRoute, selectedRoute, selectedNode, matchedOnly }),
    [graph, result, hoveredRoute, selectedRoute, selectedNode, matchedOnly],
  );

  return (
    <section aria-label="Service graph" className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          const next = selectionAfter(changes, selectedNode);
          if (next !== selectedNode) onSelectNode(next);
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.1}
        fitView
        fitViewOptions={{ padding: 0.05 }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
  );
}
