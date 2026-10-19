import type { Severity } from '@sge/domain';
import { Badge } from '../atoms/Badge';

const severityColors: Record<Severity, string> = {
  critical: 'bg-red-800 text-white',
  high: 'bg-red-100 text-red-900',
  medium: 'bg-amber-100 text-amber-900',
  low: 'bg-sky-100 text-sky-900',
  unknown: 'bg-slate-200 text-slate-800',
};

interface SeverityBadgeProps {
  severity: Severity;
  title?: string | undefined;
}

export function SeverityBadge({ severity, title }: SeverityBadgeProps) {
  return (
    <Badge className={severityColors[severity]} title={title}>
      {severity}
    </Badge>
  );
}
