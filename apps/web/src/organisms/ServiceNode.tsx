import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '../atoms/Badge';
import { NodeShape } from '../molecules/NodeShape';
import { PublicBadge } from '../molecules/PublicBadge';
import { SeverityBadge } from '../molecules/SeverityBadge';
import { highestSeverity } from '../lib/graph';
import type { ServiceFlowNode } from '../lib/toFlowGraph';

export function ServiceNode({ data: { node, sink, entry, highlighted }, selected, targetPosition = Position.Top, sourcePosition = Position.Bottom }: NodeProps<ServiceFlowNode>) {
  const severity = highestSeverity(node);
  const vulnCount = node.vulnerabilities.length;

  return (
    <div
      data-node={node.name}
      data-sink={sink}
      data-entry={entry}
      data-inferred={node.inferred}
      data-highlighted={highlighted}
      data-selected={selected}
      className={`size-full transition-opacity ${highlighted === false ? 'opacity-25' : ''}`}
    >
      <Handle type="target" position={targetPosition} className="opacity-0" />
      <NodeShape
        sink={sink}
        inferred={node.inferred}
        entry={entry}
        className={`flex size-full flex-col items-center justify-center gap-1 px-3 ${selected ? 'shadow-hard-accent ring-2 ring-accent' : highlighted ? 'ring-2 ring-accent ring-offset-1' : ''}`}
      >
        <span className="max-w-full truncate text-sm font-medium" title={node.name}>
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
      <Handle type="source" position={sourcePosition} className="opacity-0" />
    </div>
  );
}
