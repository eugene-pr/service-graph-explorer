import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border border-slate-300 px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600 ${className}`}
      {...props}
    />
  );
}
