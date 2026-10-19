import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadGraph } from './graph/loadGraph.js';

const graph = loadGraph({
  nodes: [
    { name: 'web', kind: 'service', publicExposed: true },
    {
      name: 'db',
      kind: 'rds',
      vulnerabilities: [{ file: 'db.sql', severity: 'high', message: 'm' }],
    },
  ],
  edges: [{ from: 'web', to: ['db', 'missing'] }],
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp(graph);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /api/graph', () => {
  it('returns nodes as {id, data}, edges as {id, source, target}, and load warnings', async () => {
    const app = buildApp(graph);
    const res = await app.inject({ method: 'GET', url: '/api/graph' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      nodes: [
        { id: 'web', data: { name: 'web', kind: 'service', publicExposed: true, vulnerabilities: [], inferred: false } },
        {
          id: 'db',
          data: {
            name: 'db',
            kind: 'rds',
            publicExposed: false,
            vulnerabilities: [{ file: 'db.sql', severity: 'high', message: 'm' }],
            inferred: false,
          },
        },
        { id: 'missing', data: { name: 'missing', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: true } },
      ],
      edges: [
        { id: 'web->db', source: 'web', target: 'db' },
        { id: 'web->missing', source: 'web', target: 'missing' },
      ],
      meta: { warnings: [expect.stringContaining('"missing"')] },
    });
  });
});
