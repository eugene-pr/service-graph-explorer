import type { Severity } from '@sge/domain';
import { Badge } from '../atoms/Badge';

const severityColors: Record<Severity, string> = {
  critical: 'bg-severity-critical-bg text-severity-critical',
  high: 'bg-severity-high-bg text-severity-high',
  medium: 'bg-severity-medium-bg text-severity-medium',
  low: 'bg-severity-low-bg text-severity-low',
  unknown: 'bg-surface text-text-muted',
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
