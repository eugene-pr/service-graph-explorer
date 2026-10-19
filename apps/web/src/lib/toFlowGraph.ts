import type { GraphNode, GraphResponse, RoutesResponse } from '@sge/domain';
import { MarkerType, type Edge, type Node, type NodeChange } from '@xyflow/react';
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH, type Layout } from './layout';

export type ServiceFlowNode = Node<
  { node: GraphNode; sink: boolean; entry: boolean; highlighted?: boolean | undefined },
  'service'
>;

const flowNodes = new WeakMap<Layout, ServiceFlowNode[]>();

/** A Route's identity survives a reordered result without storing server data in the UI store. */
export const routeKey = (route: readonly string[]) => JSON.stringify(route);

/** What the layout covers: the matched nodes and edges when only they are shown, else the whole graph. */
export function layoutSource(graph: GraphResponse, result: RoutesResponse | undefined, matchedOnly: boolean) {
  return matchedOnly && result ? result : graph;
}

function layoutNodes(graph: GraphResponse, source: ReturnType<typeof layoutSource>, aspect: number): ServiceFlowNode[] {
  const layout = layoutGraph(source, aspect);
  const cached = flowNodes.get(layout);
  if (cached) return cached;

  const sinkKinds = new Set(graph.meta.sinkKinds);
  const targets = new Set(graph.edges.map(({ target }) => target));
  const nodes = graph.nodes.map(({ id, data }): ServiceFlowNode => ({
    id,
    type: 'service',
    ariaLabel: id,
    position: layout.positions.get(id) ?? { x: 0, y: 0 },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    data: { node: data, sink: sinkKinds.has(data.kind), entry: !targets.has(id) },
  }));
  flowNodes.set(layout, nodes);
  return nodes;
}

const edgeStyles = {
  normal: { stroke: 'var(--color-text-faint)' },
  highlighted: { stroke: 'var(--color-accent)', strokeWidth: 2 },
  dimmed: { stroke: 'var(--color-text-faint)', opacity: 0.15 },
};

/** Convert and style the graph without changing its inputs. Layout fits a canvas of `aspect` (width / height). */
export function toFlowGraph(
  graph: GraphResponse,
  result?: RoutesResponse,
  { hoveredRoute, selectedRoute, selectedNode, matchedOnly = false, aspect = 16 / 10, positions }: {
    hoveredRoute?: string | undefined;
    selectedRoute?: string | undefined;
    selectedNode?: string | undefined;
    matchedOnly?: boolean;
    /** Canvas width / height; a 16:10 canvas until measured. */
    aspect?: number | undefined;
    /** Positions overriding the layout, by node id. */
    positions?: Readonly<Record<string, { x: number; y: number }>> | undefined;
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

  const nodes = layoutNodes(graph, layoutSource(graph, result, matchedOnly), aspect).map((node) => ({
    ...node,
    position: positions?.[node.id] ?? node.position,
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
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyles[state].stroke },
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
