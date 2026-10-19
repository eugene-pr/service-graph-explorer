import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { DEFAULT_GRAPH_FILE, loadGraph, loadGraphFile, loadGraphFromEnv } from './loadGraph.js';

const service = (name: string) => ({ name, kind: 'service' });

describe('loadGraph', () => {
  it('accepts `to` as a single string or an array', () => {
    const graph = loadGraph({
      nodes: [service('a'), service('b'), service('c')],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: ['c'] },
      ],
    });

    expect(graph.edges).toEqual([
      { id: 'a->b', source: 'a', target: 'b' },
      { id: 'b->c', source: 'b', target: 'c' },
    ]);
    expect(graph.warnings).toEqual([]);
  });

  it('adds an Inferred Node, with a warning, for an edge target missing from nodes', () => {
    const graph = loadGraph({ nodes: [service('a')], edges: [{ from: 'a', to: ['missing'] }] });

    expect(graph.nodes.find((n) => n.name === 'missing')).toEqual({
      name: 'missing',
      kind: 'service',
      publicExposed: false,
      vulnerabilities: [],
      inferred: true,
    });
    expect(graph.edges).toEqual([{ id: 'a->missing', source: 'a', target: 'missing' }]);
    expect(graph.warnings).toEqual([expect.stringContaining('"missing"')]);
  });

  it('merges duplicate edges, with a warning', () => {
    const graph = loadGraph({
      nodes: [service('a'), service('b')],
      edges: [
        { from: 'a', to: ['b', 'b'] },
        { from: 'a', to: 'b' },
      ],
    });

    expect(graph.edges).toEqual([{ id: 'a->b', source: 'a', target: 'b' }]);
    expect(graph.warnings).toEqual([expect.stringContaining('"a" -> "b"')]);
  });

  it('maps unknown severities to `unknown`, with a warning, and keeps known ones', () => {
    const vuln = (severity: string) => ({ file: 'f.java', severity, message: 'm', metadata: { cwe: 'CWE-89' } });
    const graph = loadGraph({
      nodes: [{ ...service('a'), vulnerabilities: [vuln('high'), vuln('catastrophic')] }],
      edges: [],
    });

    expect(graph.nodes[0]?.vulnerabilities).toEqual([
      vuln('high'),
      { ...vuln('catastrophic'), severity: 'unknown' },
    ]);
    expect(graph.warnings).toEqual([expect.stringContaining('"catastrophic"')]);
  });

  it('fails on structurally invalid input with a readable error naming the bad field', () => {
    expect(() => loadGraph({ nodes: [{ name: 'a' }], edges: [] })).toThrow(/invalid graph file[\s\S]*nodes\[0\]\.kind/i);
  });

  it('keeps distinct edges apart when node names contain `->`', () => {
    const graph = loadGraph({
      nodes: [service('a'), service('b->c'), service('a->b'), service('c')],
      edges: [
        { from: 'a', to: 'b->c' },
        { from: 'a->b', to: 'c' },
      ],
    });

    expect(graph.edges.map(({ source, target }) => [source, target])).toEqual([
      ['a', 'b->c'],
      ['a->b', 'c'],
    ]);
    expect(new Set(graph.edges.map((e) => e.id)).size).toBe(2);
    expect(graph.warnings).toEqual([]);
  });

  it('fails on duplicate node names', () => {
    expect(() => loadGraph({ nodes: [service('a'), service('a')], edges: [] })).toThrow(/duplicate node name "a"/i);
  });
});

describe('the loaded Graph', () => {
  const graph = loadGraph({
    nodes: [service('a'), service('b'), { name: 'db', kind: 'rds' }, service('c'), { name: 'q', kind: 'sqs' }],
    edges: [
      { from: 'a', to: ['c', 'b'] },
      { from: 'b', to: 'db' },
      { from: 'c', to: ['db', 'q', 'undeclared'] },
    ],
  });

  it('looks nodes up by name, including Inferred Nodes', () => {
    expect(graph.node('db')).toMatchObject({ name: 'db', kind: 'rds' });
    expect(graph.node('undeclared')).toMatchObject({ name: 'undeclared', inferred: true });
    expect(graph.node('nope')).toBeUndefined();
  });

  it('gives forward and reverse adjacency in source-data order', () => {
    expect(graph.successors('a')).toEqual(['c', 'b']);
    expect(graph.successors('c')).toEqual(['db', 'q', 'undeclared']);
    expect(graph.successors('db')).toEqual([]);
    expect(graph.predecessors('db')).toEqual(['b', 'c']);
    expect(graph.predecessors('a')).toEqual([]);
  });

  it('looks edges up by their endpoints', () => {
    expect(graph.edge('a', 'c')).toEqual({ id: 'a->c', source: 'a', target: 'c' });
    expect(graph.edge('c', 'a')).toBeUndefined();
  });

  it('lists the kinds present, in source-data order', () => {
    expect(graph.kinds).toEqual(['service', 'rds', 'sqs']);
  });

  it('gives the `GET /api/graph` response shape', () => {
    const response = graph.toResponse();
    expect(response.nodes.map((n) => n.id)).toEqual(['a', 'b', 'db', 'c', 'q', 'undeclared']);
    expect(response.nodes[2]).toEqual({ id: 'db', data: graph.node('db') });
    expect(response.edges).toHaveLength(6);
    expect(response.meta.warnings).toEqual([expect.stringContaining('"undeclared"')]);
  });
});

describe('loadGraphFile', () => {
  it('loads the bundled data with exactly one Inferred Node, `assurance-service`', async () => {
    const graph = await loadGraphFile(DEFAULT_GRAPH_FILE);

    expect(graph.nodes.filter((n) => n.inferred).map((n) => n.name)).toEqual(['assurance-service']);
    expect(graph.warnings).toEqual([expect.stringContaining('"assurance-service"')]);
  });

  it('fails with a readable error when the file is missing', async () => {
    await expect(loadGraphFile('/no/such/graph.json')).rejects.toThrow(/could not be read/i);
  });

  it('fails with a readable error when the file is not JSON', async () => {
    await expect(loadGraphFile(new URL(import.meta.url))).rejects.toThrow(/not valid JSON/i);
  });
});

describe('loadGraphFromEnv', () => {
  it('loads the bundled data when `GRAPH_FILE` is not set', async () => {
    const graph = await loadGraphFromEnv({});

    expect(graph.nodes.filter((n) => n.inferred).map((n) => n.name)).toEqual(['assurance-service']);
  });

  it('loads the file `GRAPH_FILE` names', async () => {
    const file = fileURLToPath(new URL('../test/graph.fixture.json', import.meta.url));
    const graph = await loadGraphFromEnv({ GRAPH_FILE: file });

    expect(graph.nodes.map((n) => n.name)).toEqual(['only']);
  });
});
