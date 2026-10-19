import { filterCatalog, type FilterCatalog } from '@sge/domain';
import { z } from 'zod';
import { createFilters } from '../filters/filter.js';
import { implementations } from '../filters/index.js';

/** The real Filters plus fixture ones, registered without touching the engine or HTTP layer. */
export const fixtureCatalog = {
  ...filterCatalog,
  visits: {
    description: 'Passes through the named node.',
    position: 'any',
    params: z.strictObject({ node: z.string().min(1) }),
  },
  endsAtKind: {
    description: 'Ends at a node of one of these kinds.',
    position: 'end',
    params: z.strictObject({ kinds: z.array(z.string()).min(1) }),
  },
  maxHops: {
    description: 'Has at most this many edges.',
    position: 'route',
    params: z.strictObject({ hops: z.number().int().min(1) }),
  },
} satisfies FilterCatalog;

export const fixtureFilters = createFilters(fixtureCatalog, {
  ...implementations,
  visits: ({ node }) => ({ node: (candidate) => candidate.name === node }),
  endsAtKind: ({ kinds }) => ({ node: (candidate) => kinds.includes(candidate.kind) }),
  maxHops: ({ hops }) => ({ route: (route) => route.length - 1 <= hops }),
});
