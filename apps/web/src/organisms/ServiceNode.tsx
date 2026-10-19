import type { GraphNode } from '@sge/domain';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Badge } from '../atoms/Badge';
import { NodeShape } from '../molecules/NodeShape';
import { PublicBadge } from '../molecules/PublicBadge';
import { SeverityBadge } from '../molecules/SeverityBadge';
import { highestSeverity, isSink } from '../lib/graph';

export type ServiceFlowNode = Node<{ node: GraphNode }, 'service'>;

export function ServiceNode({ data: { node } }: NodeProps<ServiceFlowNode>) {
  const sink = isSink(node);
  const severity = highestSeverity(node);
  const vulnCount = node.vulnerabilities.length;

  return (
    <div data-node={node.name} data-sink={sink} data-inferred={node.inferred} className="size-full">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <NodeShape
        sink={sink}
        inferred={node.inferred}
        className="flex size-full flex-col items-center justify-center gap-1 px-3 shadow-sm"
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
