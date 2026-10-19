import type { FiltersResponse, GraphResponse, RoutesResponse } from '@sge/domain';

/** A small graph covering every node visual: public, vulnerable, Sink, Inferred Node. */
export const graphFixture: GraphResponse = {
  nodes: [
    {
      id: 'frontend',
      data: { name: 'frontend', kind: 'service', language: 'java', publicExposed: true, vulnerabilities: [], inferred: false },
    },
    {
      id: 'auth-service',
      data: {
        name: 'auth-service',
        kind: 'service',
        language: 'java',
        publicExposed: false,
        vulnerabilities: [
          { file: 'Auth.java', severity: 'medium', message: 'SQL injection', metadata: { cwe: 'CWE-89' } },
          { file: 'Auth.java', severity: 'high', message: 'Path traversal', metadata: { cwe: 'CWE-22' } },
        ],
        inferred: false,
      },
    },
    {
      id: 'prod-postgresdb',
      data: { name: 'prod-postgresdb', kind: 'rds', publicExposed: false, vulnerabilities: [], inferred: false },
    },
    {
      id: 'assurance-service',
      data: { name: 'assurance-service', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: true },
    },
  ],
  edges: [
    { id: 'frontend->auth-service', source: 'frontend', target: 'auth-service' },
    { id: 'auth-service->prod-postgresdb', source: 'auth-service', target: 'prod-postgresdb' },
    { id: 'frontend->assurance-service', source: 'frontend', target: 'assurance-service' },
  ],
  meta: {
    warnings: ['Node "assurance-service" is referenced by an edge but not defined; added as an Inferred Node of kind "service".'],
    kinds: ['service', 'rds'],
    sinkKinds: ['rds'],
  },
};

export const filtersFixture: FiltersResponse = {
  filters: [
    {
      name: 'startsAtEntry',
      description: 'Starts at an Entry.',
      position: 'start',
      params: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'startsAtPublic',
      description: 'Starts at a publicly exposed service.',
      position: 'start',
      params: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'endsAtSink',
      description: 'Ends at a Sink.',
      position: 'end',
      params: {
        type: 'object',
        properties: {
          kinds: { type: 'array', items: { type: 'string' }, description: 'Node kinds that count as Sinks.', 'x-options': 'nodeKinds' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'hasVulnerability',
      description: 'Passes through a node with a vulnerability.',
      position: 'any',
      params: {
        type: 'object',
        properties: {
          minSeverity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Lowest severity that counts.' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'passesThroughFixture',
      description: 'Passes through the named node.',
      position: 'any',
      params: { type: 'object', properties: { node: { type: 'string' } }, required: ['node'], additionalProperties: false },
    },
  ],
};

/** A `GET /api/routes` response for these Routes over `graphFixture`. */
export function routesFixture(routes: string[][], { truncated = false, limit = 100 } = {}): RoutesResponse {
  const names = new Set(routes.flat());
  const edgeIds = new Set(routes.flatMap((route) => route.slice(1).map((target, i) => `${route[i]}->${target}`)));
  return {
    nodes: graphFixture.nodes.filter((n) => names.has(n.id)),
    edges: graphFixture.edges.filter((e) => edgeIds.has(e.id)),
    routes,
    meta: { routeCount: routes.length, truncated, limit, effectiveQuery: { and: [] }, warnings: graphFixture.meta.warnings },
  };
}

/** Routes from the Entry `frontend`: what the default view returns. */
export const entryRoutes = [
  ['frontend', 'auth-service', 'prod-postgresdb'],
  ['frontend', 'assurance-service'],
];
