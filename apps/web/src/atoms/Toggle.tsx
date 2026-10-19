import type { InputHTMLAttributes } from 'react';

type ToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Toggle({ className = '', ...props }: ToggleProps) {
  return (
    <input
      type="checkbox"
      className={`size-4 accent-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className}`}
      {...props}
    />
  );
}
