import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  /** Color classes; the text label carries the meaning, color only reinforces it. */
  className?: string;
  title?: string | undefined;
}

export function Badge({ children, className = 'bg-slate-100 text-slate-800', title }: BadgeProps) {
  return (
    <span title={title} className={`inline-flex items-center rounded px-1.5 py-px text-[11px] font-semibold leading-4 ${className}`}>
      {children}
    </span>
  );
}
