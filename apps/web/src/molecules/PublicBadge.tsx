import { Badge } from '../atoms/Badge';

export function PublicBadge() {
  return (
    <Badge className="bg-indigo-100 text-indigo-900" title="Publicly exposed">
      public
    </Badge>
  );
}
