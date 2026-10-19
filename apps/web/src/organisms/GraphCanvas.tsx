import type { GraphResponse, RoutesResponse } from '@sge/domain';
import { Background, Controls, MiniMap, ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutGraph } from '../lib/layout';
import { selectionAfter, toFlowGraph, type ServiceFlowNode } from '../lib/toFlowGraph';
import { useUiStore } from '../store/uiStore';
import { ServiceNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };
const fitViewOptions = { padding: 0.05 };

interface GraphCanvasProps {
  graph: GraphResponse;
  /** Only the current Query result; absent while a new Query runs. */
  result: RoutesResponse | undefined;
  matchedOnly: boolean;
  /** Name of the selected node. */
  selectedNode?: string | undefined;
  onSelectNode: (name: string | undefined) => void;
}

/**
 * Canvas aspect ratio the layout is fitted to. It follows the first measurement, then changes only when a
 * resize flips the layout direction, so ordinary resizes keep the nodes where they are.
 */
function useLayoutAspect(graph: GraphResponse) {
  const ref = useRef<HTMLElement>(null);
  const [aspect, setAspect] = useState<number>();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width = 0, height = 0 } = entry?.contentRect ?? {};
      if (!width || !height) return;
      const next = width / height;
      setAspect((current) =>
        current !== undefined && layoutGraph(graph, current).direction === layoutGraph(graph, next).direction ? current : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [graph]);
  return { ref, aspect };
}

export function GraphCanvas({ graph, result, matchedOnly, selectedNode, onSelectNode }: GraphCanvasProps) {
  const hoveredRoute = useUiStore((s) => s.hoveredRoute);
  const selectedRoute = useUiStore((s) => s.selectedRoute);
  const positions = useUiStore((s) => s.nodePositions);
  const moveNode = useUiStore((s) => s.moveNode);
  const { ref, aspect } = useLayoutAspect(graph);
  const { nodes, edges } = useMemo(
    () => toFlowGraph(graph, result, { hoveredRoute, selectedRoute, selectedNode, matchedOnly, aspect, positions }),
    [graph, result, hoveredRoute, selectedRoute, selectedNode, matchedOnly, aspect, positions],
  );
  // The `fitView` prop fits only the first layout; refit each new one.
  const flow = useRef<ReactFlowInstance<ServiceFlowNode>>(null);
  useEffect(() => {
    void flow.current?.fitView(fitViewOptions);
  }, [aspect]);

  return (
    <section ref={ref} aria-label="Service graph" className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => { flow.current = instance; }}
        onNodesChange={(changes) => {
          for (const change of changes) {
            if (change.type === 'position' && change.position) moveNode(change.id, change.position);
          }
          const next = selectionAfter(changes, selectedNode);
          if (next !== selectedNode) onSelectNode(next);
        }}
        selectNodesOnDrag={false}
        nodesConnectable={false}
        minZoom={0.1}
        fitView
        fitViewOptions={fitViewOptions}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Service graph overview" />
      </ReactFlow>
    </section>
  );
}
