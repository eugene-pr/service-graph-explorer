import type { GraphResponse } from '@sge/domain';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type { Highlight } from '../lib/highlight';
import { layoutTopDown, NODE_HEIGHT, NODE_WIDTH } from '../lib/layout';
import { ServiceNode, type ServiceFlowNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };

interface GraphCanvasProps {
  graph: GraphResponse;
  /** Matched nodes and edges; everything else is dimmed. None: nothing is dimmed. */
  highlight?: Highlight | undefined;
  /** Name of the selected node. */
  selectedNode?: string | undefined;
  onSelectNode: (name: string | undefined) => void;
}

const edgeStyles = {
  normal: {},
  highlighted: { stroke: '#4338ca', strokeWidth: 2 },
  dimmed: { opacity: 0.15 },
};

export function GraphCanvas({ graph, highlight, selectedNode, onSelectNode }: GraphCanvasProps) {
  const laidOut = useMemo(() => {
    const positions = layoutTopDown(
      graph.nodes.map((n) => n.id),
      graph.edges,
    );
    const sinkKinds = new Set(graph.meta.sinkKinds);
    const nodes: ServiceFlowNode[] = graph.nodes.map(({ id, data }) => ({
      id,
      type: 'service',
      ariaLabel: id,
      position: positions.get(id) ?? { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: { node: data, sink: sinkKinds.has(data.kind) },
    }));
    return { nodes, edges: graph.edges };
  }, [graph]);

  // Separate from layout, so a new Query restyles without re-running dagre.
  const { nodes, edges } = useMemo(() => {
    const nodes = laidOut.nodes.map((node) => ({
      ...node,
      selected: node.id === selectedNode,
      data: { ...node.data, highlighted: highlight && highlight.nodes.has(node.id) },
    }));
    const edges: Edge[] = laidOut.edges.map((edge) => {
      const state = !highlight ? 'normal' : highlight.edges.has(edge.id) ? 'highlighted' : 'dimmed';
      return {
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed, ...(state === 'highlighted' && { color: edgeStyles.highlighted.stroke }) },
        style: edgeStyles[state],
        zIndex: state === 'highlighted' ? 1 : 0,
      };
    });
    return { nodes, edges };
  }, [laidOut, highlight, selectedNode]);

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

/** Selection is controlled: React Flow reports clicks, Enter and Escape on nodes as `select` changes. */
function selectionAfter(changes: NodeChange<ServiceFlowNode>[], current: string | undefined): string | undefined {
  const selects = changes.filter((change) => change.type === 'select');
  const selected = selects.find((change) => change.selected);
  if (selected) return selected.id;
  return selects.some((change) => change.id === current) ? undefined : current;
}
