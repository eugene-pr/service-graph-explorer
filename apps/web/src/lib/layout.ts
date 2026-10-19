import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from '@dagrejs/dagre';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;

export interface Position {
  x: number;
  y: number;
}

/** Top-down dagre layout. Returns each node's top-left corner, as React Flow expects. */
export function layoutTopDown(
  nodeIds: readonly string[],
  edges: readonly { source: string; target: string }[],
): Map<string, Position> {
  const g = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  g.setGraph({ rankdir: 'TB', nodesep: 16, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of nodeIds) g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const { source, target } of edges) g.setEdge(source, target);

  layout(g);

  return new Map(
    nodeIds.map((id) => {
      const { x = 0, y = 0 } = g.node(id);
      return [id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }];
    }),
  );
}
