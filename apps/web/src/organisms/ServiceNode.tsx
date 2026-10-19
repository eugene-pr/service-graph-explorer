import type { GraphNode } from '@sge/domain';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '../atoms/Badge';
import { NodeShape } from '../molecules/NodeShape';
import { PublicBadge } from '../molecules/PublicBadge';
import { SeverityBadge } from '../molecules/SeverityBadge';
import { highestSeverity } from '../lib/graph';

export type ServiceFlowNode = Node<
  {
    node: GraphNode;
    /** Its kind is one of the graph's default Sink kinds, as served by the API. */
    sink: boolean;
    /** On a matched Route; undefined when no Query result is shown. */
    highlighted?: boolean | undefined;
  },
  'service'
>;

export function ServiceNode({ data: { node, sink, highlighted }, selected }: NodeProps<ServiceFlowNode>) {
  const severity = highestSeverity(node);
  const vulnCount = node.vulnerabilities.length;

  return (
    <div
      data-node={node.name}
      data-sink={sink}
      data-inferred={node.inferred}
      data-highlighted={highlighted}
      data-selected={selected}
      className={`size-full transition-opacity ${highlighted === false ? 'opacity-25' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <NodeShape
        sink={sink}
        inferred={node.inferred}
        className={`flex size-full flex-col items-center justify-center gap-1 px-3 shadow-sm ${selected ? 'ring-4 ring-amber-500 ring-offset-1' : highlighted ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
      >
        <span className="max-w-full truncate text-sm font-medium text-slate-900" title={node.name}>
          {node.name}
        </span>
        <span className="flex flex-wrap justify-center gap-1">
          {sink && <Badge>{node.kind}</Badge>}
          {node.publicExposed && <PublicBadge />}
          {severity && (
            <SeverityBadge
              severity={severity}
              title={`${vulnCount} ${vulnCount === 1 ? 'vulnerability' : 'vulnerabilities'}, highest severity ${severity}`}
            />
          )}
          {node.inferred && <Badge title="Referenced by an edge but missing from the source data">inferred</Badge>}
        </span>
      </NodeShape>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
