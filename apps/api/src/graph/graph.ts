import type { GraphEdge, GraphNode, GraphResponse } from '@sge/domain';

/** A loaded, normalized graph with the lookups the engine, validation and Filters share. */
export interface Graph {
  /** In source-data order; Inferred Nodes last. */
  readonly nodes: readonly GraphNode[];
  /** In source-data order. */
  readonly edges: readonly GraphEdge[];
  readonly warnings: readonly string[];
  /** Node kinds present, in order of first appearance. */
  readonly kinds: readonly string[];
  node(name: string): GraphNode | undefined;
  edge(source: string, target: string): GraphEdge | undefined;
  /** Targets of a node's outgoing edges, in source-data order. */
  successors(name: string): readonly string[];
  /** Sources of a node's incoming edges, in source-data order. */
  predecessors(name: string): readonly string[];
  toResponse(): GraphResponse;
}

/** Expects normalized input: unique node names, and every edge endpoint present in `nodes`. */
export function createGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[], warnings: readonly string[]): Graph {
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const forward = new Map<string, string[]>(nodes.map((node) => [node.name, []]));
  const reverse = new Map<string, string[]>(nodes.map((node) => [node.name, []]));
  const edgesByEnds = new Map<string, Map<string, GraphEdge>>();
  for (const edge of edges) {
    forward.get(edge.source)?.push(edge.target);
    reverse.get(edge.target)?.push(edge.source);
    const out = edgesByEnds.get(edge.source) ?? new Map<string, GraphEdge>();
    out.set(edge.target, edge);
    edgesByEnds.set(edge.source, out);
  }
  const kinds = [...new Set(nodes.map((node) => node.kind))];
  const response: GraphResponse = {
    nodes: nodes.map((node) => ({ id: node.name, data: node })),
    edges: [...edges],
    meta: { warnings: [...warnings] },
  };

  return {
    nodes,
    edges,
    warnings,
    kinds,
    node: (name) => byName.get(name),
    edge: (source, target) => edgesByEnds.get(source)?.get(target),
    successors: (name) => forward.get(name) ?? [],
    predecessors: (name) => reverse.get(name) ?? [],
    toResponse: () => response,
  };
}
