import type { ReactNode } from 'react';

interface NodeShapeProps {
  /** Sinks get a cylinder-like outline with a lavender fill; services a rectangle. */
  sink: boolean;
  /** Inferred Nodes get a dashed border and muted text. */
  inferred: boolean;
  /** Entries render navy with white text. */
  entry?: boolean;
  className?: string;
  children?: ReactNode;
}

export function NodeShape({ sink, inferred, entry = false, className = '', children }: NodeShapeProps) {
  const shape = sink ? 'rounded-[50%/14px]' : 'rounded-sm';
  const fill = entry ? 'bg-entry text-entry-fg' : sink ? 'bg-sink' : 'bg-white';
  const text = entry ? '' : inferred ? 'text-inferred-fg' : 'text-ink';
  const border = inferred
    ? 'border-dashed border-inferred-border'
    : `border-solid ${sink ? 'border-sink-border' : entry ? 'border-entry' : 'border-border'}`;
  return <div className={`border-2 ${shape} ${fill} ${text} ${border} ${className}`}>{children}</div>;
}
