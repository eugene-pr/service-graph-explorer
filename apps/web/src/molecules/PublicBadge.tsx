import { Badge } from '../atoms/Badge';

export function PublicBadge() {
  return (
    <Badge pill className="bg-accent text-white" title="Publicly exposed">
      public
    </Badge>
  );
}
