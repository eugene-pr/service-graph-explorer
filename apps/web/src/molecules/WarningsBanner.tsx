interface WarningsBannerProps {
  warnings: readonly string[];
}

export function WarningsBanner({ warnings }: WarningsBannerProps) {
  if (warnings.length === 0) return null;
  return (
    <section aria-labelledby="data-warnings-title" className="border-b border-severity-medium bg-severity-medium-bg px-4 py-2 text-sm text-ink">
      <h2 id="data-warnings-title" className="font-semibold">
        Data warnings ({warnings.length})
      </h2>
      {/* Bounded so many warnings can't squeeze the canvas to zero height; focusable so the keyboard can scroll it. */}
      <ul tabIndex={0} aria-label="Warning list" className="max-h-24 list-disc overflow-y-auto pl-5">

        {warnings.map((warning, i) => (
          <li key={i}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
