import type { GraphResponse } from '@sge/domain';

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
  },
};
