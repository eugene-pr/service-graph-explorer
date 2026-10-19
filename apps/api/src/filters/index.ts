import { filterCatalog } from '@sge/domain';
import { createFilters, type FilterImplementations } from './filter.js';

export const implementations: FilterImplementations<typeof filterCatalog> = {
  startsAtEntry: (_params, graph) => ({ node: (node) => graph.predecessors(node.name).length === 0 }),
  startsAtPublic: () => ({ node: (node) => node.publicExposed }),
};

/** Every Filter in the Filter Catalog, with its check. */
export const filters = createFilters(filterCatalog, implementations);
