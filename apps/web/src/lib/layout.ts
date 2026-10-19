import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from '@dagrejs/dagre';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;

export type LayoutDirection = 'TB' | 'LR';

interface LayoutInput {
  nodes: readonly { id: string }[];
  edges: readonly { source: string; target: string }[];
}

export interface Layout {
  direction: LayoutDirection;
  /** Top-left corner of each node; the bounding box starts at 0,0. */
  positions: ReadonlyMap<string, { x: number; y: number }>;
  width: number;
  height: number;
}

const layered = new WeakMap<LayoutInput, Map<LayoutDirection, Layout>>();

function layerGraph(graph: LayoutInput, direction: LayoutDirection): Layout {
  const byDirection = layered.get(graph) ?? new Map<LayoutDirection, Layout>();
  layered.set(graph, byDirection);
  const cached = byDirection.get(direction);
  if (cached) return cached;

  const g = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  g.setGraph({ rankdir: direction, nodesep: 16, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  // Dagre uses object dictionaries internally; keep custom names such as __proto__ outside them.
  const internalIds = new Map(graph.nodes.map(({ id }, index) => [id, `node-${index}`]));
  for (const id of internalIds.values()) g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const { source, target } of graph.edges) g.setEdge(internalIds.get(source)!, internalIds.get(target)!);
  layout(g);

  const corners = graph.nodes.map(({ id }) => {
    const { x = 0, y = 0 } = g.node(internalIds.get(id)!);
    return [id, { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }] as const;
  });
  const left = Math.min(...corners.map(([, { x }]) => x));
  const top = Math.min(...corners.map(([, { y }]) => y));
  const positions = new Map(corners.map(([id, { x, y }]) => [id, { x: x - left, y: y - top }]));
  const boxes = [...positions.values()];
  const result: Layout = {
    direction,
    positions,
    width: boxes.length ? Math.max(...boxes.map(({ x }) => x)) + NODE_WIDTH : 0,
    height: boxes.length ? Math.max(...boxes.map(({ y }) => y)) + NODE_HEIGHT : 0,
  };
  byDirection.set(direction, result);
  return result;
}

/** Size of the layout when fitted into a canvas of the given aspect ratio and height 1; smaller reads larger. */
const fittedSize = ({ width, height }: Layout, aspect: number) => Math.max(width / aspect, height);

/**
 * Lay the graph out top-to-bottom or left-to-right, whichever renders larger in a canvas of this aspect ratio
 * (width / height), then spread the ranks apart until the layout's shape matches the canvas. Spreading ranks
 * adds space without shrinking nodes on screen.
 */
export function layoutGraph(graph: LayoutInput, aspect: number): Layout {
  const tb = layerGraph(graph, 'TB');
  const lr = layerGraph(graph, 'LR');
  // Ties keep the top-down reading of Routes.
  const chosen = fittedSize(lr, aspect) < fittedSize(tb, aspect) ? lr : tb;
  return spreadRanks(chosen, aspect);
}

function spreadRanks(layout: Layout, aspect: number): Layout {
  const horizontal = layout.direction === 'LR';
  const length = horizontal ? layout.width : layout.height;
  const target = horizontal ? layout.height * aspect : layout.width / aspect;
  const nodeLength = horizontal ? NODE_WIDTH : NODE_HEIGHT;
  const span = length - nodeLength;
  if (target <= length || span <= 0) return layout;

  const scale = (target - nodeLength) / span;
  const positions = new Map([...layout.positions].map(([id, { x, y }]) => [
    id,
    horizontal ? { x: x * scale, y } : { x, y: y * scale },
  ]));
  return { ...layout, positions, ...(horizontal ? { width: target } : { height: target }) };
}
