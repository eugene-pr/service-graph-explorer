import { RawGraph } from '@sge/domain';
import { describe, expect, it } from 'vitest';
import trainTicket from '../../../../data/train-ticket-be.json';
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH } from './layout';

/** The real graph as layout sees it: declared nodes plus Inferred Nodes from edge targets. */
function realGraph() {
  const raw = RawGraph.parse(trainTicket);
  const edges = raw.edges.flatMap(({ from, to }) => (typeof to === 'string' ? [to] : to).map((target) => ({ source: from, target })));
  const ids = new Set([...raw.nodes.map(({ name }) => name), ...edges.flatMap(({ source, target }) => [source, target])]);
  return { nodes: [...ids].map((id) => ({ id })), edges };
}

const aspectOf = ({ width, height }: { width: number; height: number }) => width / height;

describe('layoutGraph', () => {
  const graph = realGraph();

  it('positions every node of the real graph without overlaps', () => {
    const { positions } = layoutGraph(graph, 16 / 10);
    expect(graph.nodes).toHaveLength(47);
    expect([...positions.keys()].sort()).toEqual(graph.nodes.map(({ id }) => id).sort());
    const boxes = [...positions.values()];
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlaps = Math.abs(a.x - b.x) < NODE_WIDTH && Math.abs(a.y - b.y) < NODE_HEIGHT;
        expect(overlaps).toBe(false);
      }
    }
  });

  it.each([16 / 10, 21 / 9, 4 / 3])('on a wide canvas (%f) lays out near the canvas aspect ratio, not a 6:1 strip', (aspect) => {
    const layout = layoutGraph(graph, aspect);
    expect(aspectOf(layout)).toBeGreaterThan(aspect / 1.25);
    expect(aspectOf(layout)).toBeLessThan(aspect * 1.25);
  });

  it('on a tall canvas lays out taller than wide', () => {
    expect(aspectOf(layoutGraph(graph, 0.6))).toBeLessThan(1);
  });

  it('reports bounds that contain every node', () => {
    const layout = layoutGraph(graph, 16 / 10);
    const boxes = [...layout.positions.values()];
    expect(Math.min(...boxes.map(({ x }) => x))).toBe(0);
    expect(Math.min(...boxes.map(({ y }) => y))).toBe(0);
    expect(Math.max(...boxes.map(({ x }) => x)) + NODE_WIDTH).toBeCloseTo(layout.width);
    expect(Math.max(...boxes.map(({ y }) => y)) + NODE_HEIGHT).toBeCloseTo(layout.height);
  });

  it('is deterministic for the same graph and aspect ratio', () => {
    expect(layoutGraph(realGraph(), 16 / 10)).toEqual(layoutGraph(realGraph(), 16 / 10));
  });

  it('lays out a chain top-to-bottom on a square canvas', () => {
    const chain = { nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }] };
    const { direction, positions } = layoutGraph(chain, 1);
    expect(direction).toBe('TB');
    expect(positions.get('a')!.y).toBeLessThan(positions.get('b')!.y);
    expect(positions.get('b')!.y).toBeLessThan(positions.get('c')!.y);
  });

  it('lays out an empty graph', () => {
    expect(layoutGraph({ nodes: [], edges: [] }, 1)).toMatchObject({ width: 0, height: 0 });
  });
});
