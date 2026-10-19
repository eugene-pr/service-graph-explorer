import { SEVERITIES } from '@sge/domain';
import { NodeShape } from '../molecules/NodeShape';
import { PublicBadge } from '../molecules/PublicBadge';
import { SeverityBadge } from '../molecules/SeverityBadge';

const shapes = [
  { label: 'Service', sink: false, inferred: false, entry: false },
  { label: 'Entry', sink: false, inferred: false, entry: true },
  { label: 'Sink', sink: true, inferred: false, entry: false },
  { label: 'Inferred Node', sink: false, inferred: true, entry: false },
];

export function Legend() {
  return (
    <section aria-labelledby="legend-title" className="space-y-3 text-sm text-text-muted">
      <h2 id="legend-title" className="font-semibold text-ink">
        Legend
      </h2>
      <dl className="space-y-2">
        <div>
          <dt className="flex">
            <PublicBadge />
          </dt>
          <dd className="text-xs">Publicly exposed service</dd>
        </div>
        <div>
          <dt className="flex flex-wrap gap-1">
            {[...SEVERITIES].reverse().map((severity) => (
              <SeverityBadge key={severity} severity={severity} />
            ))}
          </dt>
          <dd className="text-xs">Highest vulnerability severity on the node</dd>
        </div>
      </dl>
      <ul className="space-y-1.5">
        {shapes.map(({ label, sink, inferred, entry }) => (
          <li key={label} className="flex items-center gap-2">
            <NodeShape sink={sink} inferred={inferred} entry={entry} className="h-5 w-9 shrink-0" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
