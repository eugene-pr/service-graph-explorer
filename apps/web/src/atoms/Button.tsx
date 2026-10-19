import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const variants = {
  primary: 'border border-ink bg-accent text-white shadow-hard hover:bg-accent/90 active:translate-px active:shadow-none',
  secondary: 'border border-border bg-white text-ink hover:bg-surface',
};

export function Button({ variant = 'secondary', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
