import type { FilterInfo, FilterLeaf, Query } from '@sge/domain';
import { useRef, useState } from 'react';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Select';
import { ParamInputs } from '../molecules/ParamInput';
import { decodeParam, encodeParam } from '../lib/filterParams';
import { groupParts, isGroup, makeGroup, type Group } from '../lib/queryTree';

interface QueryTreeBuilderProps {
  /** The Filter Catalog; leaf param inputs are generated from it. */
  filters: readonly FilterInfo[];
  tree: Query;
  onChange: (tree: Query) => void;
  /** The node kinds in the graph, for params whose values are node kinds; undefined until the graph loads. */
  nodeKinds: readonly string[] | undefined;
}

interface Context {
  filters: readonly FilterInfo[];
  nodeKinds: readonly string[] | undefined;
}

/** What every part of the tree gets: its position, e.g. `query.and.0.or.1` as in the API's errors, and how to replace it. */
interface NodeProps {
  path: string;
  context: Context;
  onChange: (node: Query) => void;
}

const labelOf = (node: Query) =>
  'and' in node ? 'AND group' : 'or' in node ? 'OR group' : 'not' in node ? 'NOT' : node.filter;

/** A member's 1-based position for its accessible name, e.g. `query.and.0.or.1` → `1.2`; empty for the root. */
const positionOf = (path: string) =>
  path.split('.').filter((part) => /^\d+$/.test(part)).map((i) => Number(i) + 1).join('.');

const idOf = (path: string) => `tree-${path.replaceAll('.', '-')}`;

/** Edits an `and` / `or` / `not` tree. */
export function QueryTreeBuilder({ filters, tree, onChange, nodeKinds }: QueryTreeBuilderProps) {
  return (
    <div className="space-y-2">
      <Member node={tree} path="query" context={{ filters, nodeKinds }} onChange={onChange} />
      {!isGroup(tree) && <Button onClick={() => onChange({ and: [tree] })}>Wrap in AND group</Button>}
    </div>
  );
}

interface MemberProps extends NodeProps {
  node: Query;
  /** Undefined for the root, which can't be removed. */
  onRemove?: () => void;
}

/** One tree member. NOT is shown as a pressed toggle on the member it negates. */
function Member({ node, path, context, onChange, onRemove }: MemberProps) {
  const negated = 'not' in node;
  const inner = negated ? node.not : node;
  const position = positionOf(path);
  // Names include the position, so repeated groups and Filters stay distinguishable.
  const title = [labelOf(inner), position].filter(Boolean).join(' ');
  const name = `${negated ? 'NOT ' : ''}${title}`;
  return (
    <fieldset className={`space-y-2 rounded border border-slate-200 p-2 ${negated ? 'border-l-4 border-l-amber-500' : ''}`}>
      <legend className="px-1 font-mono text-xs font-semibold text-slate-900">
        {negated && 'NOT '}
        {labelOf(inner)}
        {position && <> <span className="font-normal text-slate-500">{position}</span></>}
      </legend>
      <div className="flex gap-1">
        <Button
          className="px-2 py-0.5 text-xs"
          aria-label={`Negate ${title}`}
          aria-pressed={negated}
          onClick={() => onChange(negated ? inner : { not: node })}
        >
          NOT
        </Button>
        {onRemove && (
          <Button className="px-2 py-0.5 text-xs" aria-label={`Remove ${name}`} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <Body
        node={inner}
        path={negated ? `${path}.not` : path}
        title={title}
        context={context}
        onChange={(next) => onChange(negated ? { not: next } : next)}
      />
    </fieldset>
  );
}

interface BodyProps extends NodeProps {
  node: Query;
  title: string;
}

function Body({ node, title, ...props }: BodyProps) {
  if ('not' in node) return <Member node={node} {...props} />;
  if ('filter' in node) return <Leaf leaf={node} {...props} />;
  return <GroupBody group={node} title={title} {...props} />;
}

interface GroupBodyProps extends NodeProps {
  group: Group;
  title: string;
}

function GroupBody({ group, title, path, context, onChange }: GroupBodyProps) {
  const { op, members } = groupParts(group);
  const [choice, setChoice] = useState('group:and');
  const adder = useRef<HTMLSelectElement>(null);
  const id = idOf(path);

  const add = () => {
    const [kind, value = ''] = choice.split(':');
    const member: Query = kind === 'filter' ? { filter: value } : makeGroup(value === 'or' ? 'or' : 'and', []);
    onChange(makeGroup(op, [...members, member]));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-operator`} className="shrink-0 text-xs text-slate-700">
          Match
        </label>
        <Select id={`${id}-operator`} value={op} onChange={(e) => onChange(makeGroup(e.target.value === 'or' ? 'or' : 'and', members))}>
          <option value="and">every member (AND)</option>
          <option value="or">any member (OR)</option>
        </Select>
      </div>
      {members.length === 0 ? (
        <p className="text-xs text-slate-500">Empty: {op === 'and' ? 'matches every Route' : 'matches no Route'}.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((member, i) => (
            <li key={i}>
              <Member
                node={member}
                path={`${path}.${op}.${i}`}
                context={context}
                onChange={(next) => onChange(makeGroup(op, members.with(i, next)))}
                onRemove={() => {
                  onChange(makeGroup(op, members.filter((_, j) => j !== i)));
                  // The removed member had focus; keep keyboard users in this group.
                  adder.current?.focus();
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <div role="group" aria-label={`Add to ${title}`} className="flex gap-1">
        <Select ref={adder} aria-label="Member" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <optgroup label="Groups">
            <option value="group:and">AND group</option>
            <option value="group:or">OR group</option>
          </optgroup>
          <optgroup label="Filters">
            {context.filters.map(({ name }) => (
              <option key={name} value={`filter:${name}`}>
                {name}
              </option>
            ))}
          </optgroup>
        </Select>
        <Button className="shrink-0" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

interface LeafProps extends NodeProps {
  leaf: FilterLeaf;
}

function Leaf({ leaf, path, context, onChange }: LeafProps) {
  const info = context.filters.find((f) => f.name === leaf.filter);

  const setParam = (param: string, value: string) => {
    const rest = Object.fromEntries(Object.entries(leaf.params ?? {}).filter(([key]) => key !== param));
    const params = value === '' ? rest : { ...rest, [param]: decodeParam(value, info?.params.properties?.[param]) };
    onChange(Object.keys(params).length > 0 ? { filter: leaf.filter, params } : { filter: leaf.filter });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">{info?.description ?? 'Unknown Filter.'}</p>
      {info && (
        <ParamInputs
          idPrefix={idOf(path)}
          params={info.params}
          values={Object.fromEntries(Object.entries(leaf.params ?? {}).map(([param, value]) => [param, encodeParam(value)]))}
          onChange={setParam}
          nodeKinds={context.nodeKinds}
        />
      )}
    </div>
  );
}
