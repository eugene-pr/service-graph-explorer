import type { ReactNode } from 'react';
import { Toggle } from '../atoms/Toggle';

interface FilterToggleProps {
  name: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Param inputs, shown while the Filter is on. */
  children?: ReactNode;
}

export function FilterToggle({ name, description, checked, onChange, children }: FilterToggleProps) {
  const id = `filter-${name}`;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Toggle
          id={id}
          className="mt-0.5 shrink-0"
          checked={checked}
          aria-describedby={`${id}-description`}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div>
          <label htmlFor={id} className="font-mono text-sm font-medium text-slate-900">
            {name}
          </label>
          <p id={`${id}-description`} className="text-xs text-slate-600">
            {description}
          </p>
        </div>
      </div>
      {checked && children}
    </div>
  );
}
