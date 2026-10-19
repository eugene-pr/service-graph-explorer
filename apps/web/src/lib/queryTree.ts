import { Query, type AndQuery, type FilterLeaf, type FlatQuery, type OrQuery, type RoutesQueryRequest } from '@sge/domain';
import { decodeParam, describeParamIssue, filterDefinitions } from './filterParams';

/** An advanced Query: an `and` / `or` / `not` tree, sent as the `POST /api/routes/query` body. */
export type TreeQuery = RoutesQueryRequest;

/** The current Query: a flat Filter list, or an advanced tree. */
export type ExplorerQuery = FlatQuery | TreeQuery;

export const isTreeQuery = (query: ExplorerQuery): query is TreeQuery => 'query' in query;

export type Group = AndQuery | OrQuery;
export type GroupOperator = 'and' | 'or';

export const isGroup = (node: Query): node is Group => 'and' in node || 'or' in node;

/** A group's operator and members, so callers needn't check `and` and `or` separately. */
export const groupParts = (group: Group): { op: GroupOperator; members: Query[] } =>
  'and' in group ? { op: 'and', members: group.and } : { op: 'or', members: group.or };

export const makeGroup = (op: GroupOperator, members: Query[]): Group => (op === 'and' ? { and: members } : { or: members });

/**
 * `tree` with `leaf` as a direct member of its top-level `and`, replacing a leaf of the same Filter, as `withFilter` does
 * for flat Queries. A tree whose root isn't an `and` becomes `and(tree, leaf)`.
 */
export function withTopLevelLeaf(tree: Query, leaf: FilterLeaf): Query {
  if (!('and' in tree)) return { and: [tree, leaf] };
  const i = tree.and.findIndex((member) => 'filter' in member && member.filter === leaf.filter);
  return { and: i === -1 ? [...tree.and, leaf] : tree.and.with(i, leaf) };
}

/** The flat Query's Filters as members of an `and` tree, with params decoded to their types. Empty params are left out. */
export function toTree({ filters, params }: FlatQuery): Query {
  return {
    and: filters.map((filter) => {
      const properties = filterDefinitions.get(filter)?.properties;
      const entries = Object.entries(params[filter] ?? {})
        .filter(([, value]) => value !== '')
        .map(([param, value]): [string, unknown] => [param, decodeParam(value, properties?.[param])]);
      return entries.length > 0 ? { filter, params: Object.fromEntries(entries) } : { filter };
    }),
  };
}

/** Problems with each leaf's Filter and params, located like the API's errors (e.g. `query.and.0.or.1`). */
export function treeErrors(query: Query, path = 'query'): string[] {
  if (isGroup(query)) {
    const { op, members } = groupParts(query);
    return members.flatMap((member, i) => treeErrors(member, `${path}.${op}.${i}`));
  }
  if ('not' in query) return treeErrors(query.not, `${path}.not`);
  const definition = filterDefinitions.get(query.filter);
  if (!definition) return [`${path}: Unknown Filter: ${query.filter}.`];
  const parsed = definition.schema.safeParse(query.params ?? {});
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => `${path}: ${describeParamIssue(query.filter, issue)}`);
}

/** The tree as URL-safe base64 (base64url) of its JSON, for the `q` URL param. */
export function encodeTree(query: Query): string {
  const binary = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(query)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The tree in a `q` URL param, or undefined when it isn't base64url JSON of a Query. */
export function decodeTree(value: string): Query | undefined {
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    const json: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
    const parsed = Query.safeParse(json);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
