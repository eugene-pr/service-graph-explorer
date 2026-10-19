import type { GraphResponse } from '@sge/domain';
import { Background, Controls, MarkerType, ReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import { layoutTopDown, NODE_HEIGHT, NODE_WIDTH } from '../lib/layout';
import { ServiceNode, type ServiceFlowNode } from './ServiceNode';

const nodeTypes = { service: ServiceNode };

interface GraphCanvasProps {
  graph: GraphResponse;
}

export function GraphCanvas({ graph }: GraphCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const positions = layoutTopDown(
      graph.nodes.map((n) => n.id),
      graph.edges,
    );
    const nodes: ServiceFlowNode[] = graph.nodes.map(({ id, data }) => ({
      id,
      type: 'service',
      ariaLabel: id,
      position: positions.get(id) ?? { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: { node: data },
    }));
    const edges: Edge[] = graph.edges.map((edge) => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed } }));
    return { nodes, edges };
  }, [graph]);

  return (
    <section aria-label="Service graph" className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
