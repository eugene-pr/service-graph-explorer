import type { ReactNode } from 'react';

interface NodeShapeProps {
  /** Sinks get a cylinder-like outline; services a rectangle. */
  sink: boolean;
  /** Inferred Nodes get a dashed border. */
  inferred: boolean;
  className?: string;
  children?: ReactNode;
}

export function NodeShape({ sink, inferred, className = '', children }: NodeShapeProps) {
  const shape = sink ? 'rounded-[50%/14px] bg-teal-50' : 'rounded-md bg-white';
  const border = inferred ? 'border-dashed border-slate-500' : 'border-solid border-slate-400';
  return <div className={`border-2 ${shape} ${border} ${className}`}>{children}</div>;
}
