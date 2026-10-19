import type { RoutesResponse } from '@sge/domain';

export interface Highlight {
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

/** The nodes and edges on any matched Route. */
export function highlightOf(result: Pick<RoutesResponse, 'nodes' | 'edges'>): Highlight {
  return { nodes: new Set(result.nodes.map((n) => n.id)), edges: new Set(result.edges.map((e) => e.id)) };
}
