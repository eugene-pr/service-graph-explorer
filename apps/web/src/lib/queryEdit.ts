import type { FilterLeaf, FlatQuery, Query } from '@sge/domain';
import { encodeParam } from './filterParams';
import { isTreeQuery, type ExplorerQuery } from './queryTree';

/** `query` narrowed to `filter` alone, keeping its params and the limit. */
export function onlyFilter(query: FlatQuery, filter: string): FlatQuery {
  return { filters: [filter], params: { [filter]: query.params[filter] ?? {} }, limit: query.limit };
}

/**
 * `filters` with `name` turned on or off, in `order` (the Filter Catalog's names), so the same Filters always make the same Query.
 * Names not in `order` keep their place after it, and none repeats.
 */
export function withFilter(filters: readonly string[], name: string, on: boolean, order: readonly string[] = []): string[] {
  return [...new Set([...order, ...filters, name])].filter((n) => (n === name ? on : filters.includes(n)));
}

/**
 * `tree` with `leaf` as a direct member of its top-level `and`, replacing a leaf of the same Filter, as `withFilter` does
 * for flat Queries. A tree whose root isn't an `and` becomes `and(tree, leaf)`.
 */
function withTopLevelLeaf(tree: Query, leaf: FilterLeaf): Query {
  if (!('and' in tree)) return { and: [tree, leaf] };
  const i = tree.and.findIndex((member) => 'filter' in member && member.filter === leaf.filter);
  return { and: i === -1 ? [...tree.and, leaf] : tree.and.with(i, leaf) };
}

/**
 * `query` with `leaf` added as a top-level Filter, replacing one of the same Filter, in either form.
 * A flat Query keeps its Filters in `order` (the Filter Catalog's names), as `withFilter` does.
 */
export function withFilterLeaf(query: ExplorerQuery, leaf: FilterLeaf, order?: readonly string[]): ExplorerQuery {
  if (isTreeQuery(query)) return { ...query, query: withTopLevelLeaf(query.query, leaf) };
  const params = Object.fromEntries(Object.entries(leaf.params ?? {}).map(([param, value]) => [param, encodeParam(value)]));
  return {
    ...query,
    filters: withFilter(query.filters, leaf.filter, true, order),
    params: { ...query.params, [leaf.filter]: params },
  };
}
