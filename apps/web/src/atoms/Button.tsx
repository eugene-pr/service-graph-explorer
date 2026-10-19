import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const variants = {
  primary: 'bg-indigo-700 text-white hover:bg-indigo-800',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100',
};

export function Button({ variant = 'secondary', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
