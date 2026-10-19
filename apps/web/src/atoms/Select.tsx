import type { ComponentProps } from 'react';

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={`w-full rounded border border-border bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-blue ${className}`}
      {...props}
    />
  );
}
