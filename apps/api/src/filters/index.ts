import { filterCatalog, SEVERITIES } from '@sge/domain';
import { createFilters, type FilterImplementations } from './filter.js';

export const implementations: FilterImplementations<typeof filterCatalog> = {
  startsAtEntry: (_params, graph) => ({ node: (node) => graph.predecessors(node.name).length === 0 }),
  startsAtPublic: () => ({ node: (node) => node.publicExposed }),
  endsAtSink: (params, graph) => {
    const kinds = params.kinds ?? graph.sinkKinds;
    const unknown = kinds.filter((kind) => !graph.kinds.includes(kind));
    if (unknown.length > 0) {
      return {
        mismatches: unknown.map((kind) => ({
          param: 'kinds',
          message: `Kind "${kind}" is not in the graph; kinds present: ${graph.kinds.join(', ')}.`,
        })),
      };
    }
    return { node: (node) => kinds.includes(node.kind) };
  },
  hasVulnerability: ({ minSeverity }) => {
    // `unknown` ranks lowest, so a threshold of `low` or above never admits it.
    const atLeast = SEVERITIES.indexOf(minSeverity ?? 'unknown');
    return { node: (node) => node.vulnerabilities.some(({ severity }) => SEVERITIES.indexOf(severity) >= atLeast) };
  },
  passesThrough: ({ node }, graph) => {
    if (!graph.node(node)) return { mismatches: [{ param: 'node', message: `Node "${node}" is not in the graph.` }] };
    return { node: (candidate) => candidate.name === node };
  },
  maxLength: ({ hops }) => ({ route: (route) => route.length - 1 <= hops, maxEdges: hops }),
};

/** Every Filter in the Filter Catalog, with its check. */
export const filters = createFilters(filterCatalog, implementations);
