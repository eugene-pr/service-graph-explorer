import type { GraphNode, GraphResponse, RoutesResponse } from '@sge/domain';
import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node, type NodeChange } from '@xyflow/react';

export type ServiceFlowNode = Node<
  { node: GraphNode; sink: boolean; highlighted?: boolean | undefined },
  'service'
>;

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const layouts = new WeakMap<GraphResponse, ServiceFlowNode[]>();

/** A Route's identity survives a reordered result without storing server data in the UI store. */
export const routeKey = (route: readonly string[]) => JSON.stringify(route);

function layoutGraph(graph: GraphResponse): ServiceFlowNode[] {
  const cached = layouts.get(graph);
  if (cached) return cached;

  const g = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  g.setGraph({ rankdir: 'TB', nodesep: 16, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const { id } of graph.nodes) g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const { source, target } of graph.edges) g.setEdge(source, target);
  layout(g);

  const sinkKinds = new Set(graph.meta.sinkKinds);
  const nodes = graph.nodes.map(({ id, data }): ServiceFlowNode => {
    const { x = 0, y = 0 } = g.node(id);
    return {
      id,
      type: 'service',
      ariaLabel: id,
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: { node: data, sink: sinkKinds.has(data.kind) },
    };
  });
  layouts.set(graph, nodes);
  return nodes;
}

const edgeStyles = {
  normal: {},
  highlighted: { stroke: '#4338ca', strokeWidth: 2 },
  dimmed: { opacity: 0.15 },
};

/** Convert and style the graph without changing its inputs. Layout is reused for each graph object. */
export function toFlowGraph(
  graph: GraphResponse,
  result?: RoutesResponse,
  { hoveredRoute, selectedRoute, selectedNode, matchedOnly = false }: {
    hoveredRoute?: string | undefined;
    selectedRoute?: string | undefined;
    selectedNode?: string | undefined;
    matchedOnly?: boolean;
  } = {},
): { nodes: ServiceFlowNode[]; edges: Edge[] } {
  // A removed hover preview must not mask a selection that still belongs to the current result.
  const route = result?.routes.find((route) => routeKey(route) === hoveredRoute)
    ?? result?.routes.find((route) => routeKey(route) === selectedRoute);
  const matchedNodes = result && new Set(result.nodes.map(({ id }) => id));
  const matchedEdges = result && new Set(result.edges.map(({ id }) => id));
  const highlightedNodes = result && new Set(route ?? result.nodes.map(({ id }) => id));
  // A Route contains consecutive edges, not every edge between its nodes.
  const highlightedEdges = result && new Set(
    result.edges.filter((edge) => !route || route.some((source, i) => source === edge.source && route[i + 1] === edge.target))
      .map(({ id }) => id),
  );

  const nodes = layoutGraph(graph).map((node) => ({
    ...node,
    selected: node.id === selectedNode,
    hidden: matchedOnly && !!matchedNodes && !matchedNodes.has(node.id),
    data: { ...node.data, highlighted: highlightedNodes?.has(node.id) },
  }));
  const edges = graph.edges.map((edge) => {
    const highlighted = highlightedEdges?.has(edge.id);
    const state = highlighted === undefined ? 'normal' : highlighted ? 'highlighted' : 'dimmed';
    const domAttributes: Edge['domAttributes'] & { 'data-highlighted': boolean | undefined } = { 'data-highlighted': highlighted };
    return {
      ...edge,
      hidden: matchedOnly && !!matchedEdges && !matchedEdges.has(edge.id),
      markerEnd: { type: MarkerType.ArrowClosed, ...(highlighted && { color: edgeStyles.highlighted.stroke }) },
      style: edgeStyles[state],
      zIndex: highlighted ? 1 : 0,
      domAttributes,
    };
  });
  return { nodes, edges };
}

/** React Flow reports clicks, Enter and Escape on nodes as selection changes. */
export function selectionAfter(changes: NodeChange<ServiceFlowNode>[], current: string | undefined): string | undefined {
  const selects = changes.filter((change) => change.type === 'select');
  const selected = selects.find((change) => change.selected);
  if (selected) return selected.id;
  return selects.some((change) => change.id === current) ? undefined : current;
}
