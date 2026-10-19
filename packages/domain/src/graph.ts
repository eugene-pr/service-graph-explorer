import { z } from 'zod';

/** Lowest first: `unknown` < `low` < `medium` < `high` < `critical`. */
export const SEVERITIES = ['unknown', 'low', 'medium', 'high', 'critical'] as const;
export const Severity = z.enum(SEVERITIES);
export type Severity = z.infer<typeof Severity>;

const VulnerabilityMetadata = z.looseObject({ cwe: z.string().optional() });

// Raw input file: the shape of `GRAPH_FILE` as found on disk.

export const RawVulnerability = z.object({
  file: z.string(),
  severity: z.string(),
  message: z.string(),
  metadata: VulnerabilityMetadata.optional(),
});
export type RawVulnerability = z.infer<typeof RawVulnerability>;

export const RawNode = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
  language: z.string().optional(),
  path: z.string().optional(),
  publicExposed: z.boolean().optional(),
  vulnerabilities: z.array(RawVulnerability).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RawNode = z.infer<typeof RawNode>;

export const RawEdge = z.object({
  from: z.string().min(1),
  to: z.union([z.string().min(1), z.array(z.string().min(1))]),
});
export type RawEdge = z.infer<typeof RawEdge>;

export const RawGraph = z.object({
  nodes: z.array(RawNode),
  edges: z.array(RawEdge),
});
export type RawGraph = z.infer<typeof RawGraph>;

// Normalized graph: what the API serves.

export const Vulnerability = RawVulnerability.extend({ severity: Severity });
export type Vulnerability = z.infer<typeof Vulnerability>;

export const GraphNode = RawNode.extend({
  publicExposed: z.boolean(),
  vulnerabilities: z.array(Vulnerability),
  /** True for an Inferred Node: referenced by an edge but missing from the source data. */
  inferred: z.boolean(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const GraphResponse = z.object({
  nodes: z.array(z.object({ id: z.string(), data: GraphNode })),
  edges: z.array(GraphEdge),
  meta: z.object({ warnings: z.array(z.string()) }),
});
export type GraphResponse = z.infer<typeof GraphResponse>;
