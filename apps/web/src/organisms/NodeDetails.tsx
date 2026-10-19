import type { GraphNode } from '@sge/domain';
import { Button } from '../atoms/Button';
import { SeverityBadge } from '../molecules/SeverityBadge';

interface NodeDetailsProps {
  node: GraphNode;
  onShowRoutesThrough: () => void;
  onClose: () => void;
}

export function NodeDetails({ node, onShowRoutesThrough, onClose }: NodeDetailsProps) {
  const fields: [string, string][] = [
    ['Kind', node.kind],
    ['Language', node.language ?? '—'],
    ['Path', node.path ?? '—'],
    ['Public', node.publicExposed ? 'yes' : 'no'],
    ['Inferred', node.inferred ? 'yes' : 'no'],
  ];

  return (
    <section
      aria-label="Node details"
      className="space-y-3 text-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="flex items-center gap-2">
        <h2 className="font-mono font-semibold text-slate-900">
          {node.name}
        </h2>
        <Button variant="primary" className="ml-auto" onClick={onShowRoutesThrough}>
          Show Routes through here
        </Button>
        <Button aria-label="Close node details" onClick={onClose}>
          ✕
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:grid-cols-[repeat(5,auto_1fr)]">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-600">{label}</dt>
            <dd className="font-mono text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="mb-1 font-medium text-slate-900">Vulnerabilities</h3>
        {node.vulnerabilities.length === 0 ? (
          <p className="text-slate-600">No vulnerabilities.</p>
        ) : (
          <ul className="space-y-1">
            {node.vulnerabilities.map(({ file, severity, message, metadata }, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2">
                <SeverityBadge severity={severity} />
                <span className="text-slate-900">{message}</span>
                <span className="font-mono text-xs text-slate-600">{file}</span>
                {metadata?.cwe && <span className="font-mono text-xs text-slate-600">{metadata.cwe}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
