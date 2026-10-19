interface RouteChipProps {
  route: readonly string[];
}

/** A Route as its node names, first to last. */
export function RouteChip({ route }: RouteChipProps) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs">
      {route.map((name, i) => (
        <span key={`${i}-${name}`} className="contents">
          {i > 0 && (
            <span aria-hidden="true" className="text-sm text-text-muted">
              →
            </span>
          )}
          <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-ink">{name}</span>
        </span>
      ))}
    </span>
  );
}
