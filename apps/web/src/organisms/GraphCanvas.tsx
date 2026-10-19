import type { GraphResponse, RoutesResponse } from '@sge/domain';
import { Background, Controls, MiniMap, Panel, ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../atoms/Button';
import { Toggle } from '../atoms/Toggle';
import { layoutGraph } from '../lib/layout';
import { layoutSource, selectionAfter, toFlowGraph, type ServiceFlowNode } from '../lib/toFlowGraph';
import { useUiStore } from '../store/uiStore';
import { ServiceNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };
const fitViewOptions = { padding: 0.05 };

interface GraphCanvasProps {
  graph: GraphResponse;
  /** Only the current Query result; absent while a new Query runs. */
  result: RoutesResponse | undefined;
  matchedOnly: boolean;
  onMatchedOnlyChange: (matchedOnly: boolean) => void;
  /** Name of the selected node. */
  selectedNode?: string | undefined;
  onSelectNode: (name: string | undefined) => void;
  onReset: () => void;
}

/**
 * Canvas aspect ratio the layout is fitted to. It follows the first measurement, then changes only when a
 * resize flips the layout direction, so ordinary resizes keep the nodes where they are.
 */
function useLayoutAspect(source: ReturnType<typeof layoutSource>) {
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
        current !== undefined && layoutGraph(source, current).direction === layoutGraph(source, next).direction ? current : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [source]);
  return { ref, aspect };
}

export function GraphCanvas({ graph, result, matchedOnly, onMatchedOnlyChange, selectedNode, onSelectNode, onReset }: GraphCanvasProps) {
  const hoveredRoute = useUiStore((s) => s.hoveredRoute);
  const selectedRoute = useUiStore((s) => s.selectedRoute);
  const positions = useUiStore((s) => s.nodePositions);
  const moveNode = useUiStore((s) => s.moveNode);
  const clearNodePositions = useUiStore((s) => s.clearNodePositions);
  const clearRouteHighlight = useUiStore((s) => s.clearRouteHighlight);
  const resetVersion = useUiStore((s) => s.resetVersion);
  const clearSelection = () => {
    onSelectNode(undefined);
    clearRouteHighlight();
  };
  const source = layoutSource(graph, result, matchedOnly);
  const { ref, aspect } = useLayoutAspect(source);
  const { nodes, edges } = useMemo(
    () => toFlowGraph(graph, result, { hoveredRoute, selectedRoute, selectedNode, matchedOnly, aspect, positions }),
    [graph, result, hoveredRoute, selectedRoute, selectedNode, matchedOnly, aspect, positions],
  );
  // Changing the layout source or its measured aspect replaces dragged positions.
  const laidOut = useRef({ source, aspect });
  useEffect(() => {
    if (laidOut.current.source === source && laidOut.current.aspect === aspect) return;
    laidOut.current = { source, aspect };
    clearNodePositions();
  }, [source, aspect, clearNodePositions]);
  // The `fitView` prop fits only the first layout; refit each new one.
  const flow = useRef<ReactFlowInstance<ServiceFlowNode>>(null);
  useEffect(() => {
    // Let React Flow apply the new positions and handle bounds before measuring the view.
    const frame = requestAnimationFrame(() => { void flow.current?.fitView(fitViewOptions); });
    return () => cancelAnimationFrame(frame);
  }, [aspect, source, resetVersion]);

  return (
    <section
      ref={ref}
      aria-label="Service graph"
      className="size-full"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          clearSelection();
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => { flow.current = instance; }}
        onPaneClick={clearSelection}
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
        <Panel position="top-left">
          <label className="flex items-center gap-2 rounded border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink has-disabled:opacity-50">
            <Toggle checked={matchedOnly} onChange={(event) => onMatchedOnlyChange(event.target.checked)} disabled={!result} />
            Matched only
          </label>
        </Panel>
        <Panel position="top-right" className="flex gap-2">
          {(selectedNode !== undefined || selectedRoute !== undefined) && (
            <Button onClick={clearSelection}>Clear selection</Button>
          )}
          <Button onClick={onReset}>Reset map</Button>
        </Panel>
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Service graph overview" />
      </ReactFlow>
    </section>
  );
}
