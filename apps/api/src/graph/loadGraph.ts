import { readFile } from 'node:fs/promises';
import { RawGraph, Severity, type GraphEdge, type GraphNode } from '@sge/domain';
import { z } from 'zod';

export interface LoadedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
}

/** The graph file can't be served: startup must fail. */
export class GraphLoadError extends Error {
  override name = 'GraphLoadError';
}

/** The bundled data file, used when `GRAPH_FILE` is not set. Same depth from `src/` and `dist/`. */
export const DEFAULT_GRAPH_FILE = new URL('../../../../data/train-ticket-be.json', import.meta.url);

export async function loadGraphFile(file: string | URL): Promise<LoadedGraph> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    throw new GraphLoadError(`Graph file ${String(file)} could not be read.`, { cause: err });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new GraphLoadError(`Graph file ${String(file)} is not valid JSON.`, { cause: err });
  }
  return loadGraph(json);
}

/** Turns raw graph JSON into a normalized graph plus data warnings. */
export function loadGraph(input: unknown): LoadedGraph {
  const parsed = RawGraph.safeParse(input);
  if (!parsed.success) throw new GraphLoadError(`Invalid graph file:\n${z.prettifyError(parsed.error)}`);
  const raw = parsed.data;
  const warnings: string[] = [];

  const nodes: GraphNode[] = raw.nodes.map((node) => ({
    ...node,
    publicExposed: node.publicExposed ?? false,
    vulnerabilities: (node.vulnerabilities ?? []).map((vuln) => {
      const severity = Severity.safeParse(vuln.severity);
      if (severity.success) return { ...vuln, severity: severity.data };
      warnings.push(`Node "${node.name}" has a vulnerability with unknown severity "${vuln.severity}"; treated as "unknown".`);
      return { ...vuln, severity: 'unknown' as const };
    }),
    inferred: false,
  }));

  const edgesById = new Map<string, GraphEdge>();
  const duplicateEdges = new Set<string>();
  for (const { from, to } of raw.edges) {
    for (const target of typeof to === 'string' ? [to] : to) {
      // Encoding escapes `>`, so `->` can only be the separator: ids stay unique even when names contain `->`.
      const id = `${encodeURIComponent(from)}->${encodeURIComponent(target)}`;
      if (!edgesById.has(id)) {
        edgesById.set(id, { id, source: from, target });
      } else if (!duplicateEdges.has(id)) {
        duplicateEdges.add(id);
        warnings.push(`Edge "${from}" -> "${target}" appears more than once; merged into one.`);
      }
    }
  }
  const edges = [...edgesById.values()];

  const known = new Set<string>();
  for (const { name } of nodes) {
    if (known.has(name)) throw new GraphLoadError(`Duplicate node name "${name}".`);
    known.add(name);
  }

  for (const { source, target } of edges) {
    for (const name of [source, target]) {
      if (known.has(name)) continue;
      known.add(name);
      nodes.push({ name, kind: 'service', publicExposed: false, vulnerabilities: [], inferred: true });
      warnings.push(`Node "${name}" is referenced by an edge but not defined; added as an Inferred Node of kind "service".`);
    }
  }

  return { nodes, edges, warnings };
}
