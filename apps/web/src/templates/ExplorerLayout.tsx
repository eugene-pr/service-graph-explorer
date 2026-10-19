import type { ReactNode } from 'react';

interface ExplorerLayoutProps {
  banner?: ReactNode;
  /** Left: the Query panel and legend. */
  sidebar: ReactNode;
  /** Center: the canvas. */
  main: ReactNode;
  /** Right: the Route list. */
  aside: ReactNode;
  /** Bottom of the center column: node details. */
  bottom?: ReactNode;
}

export function ExplorerLayout({ banner, sidebar, main, aside, bottom }: ExplorerLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-surface font-sans text-ink">
      <header className="bg-ink px-4 py-2 text-white">
        <h1 className="font-display text-lg font-bold">Service Graph Explorer</h1>
      </header>
      {banner}
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 space-y-6 overflow-y-auto border-r border-border bg-white p-4">{sidebar}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1 bg-surface">{main}</main>
          {bottom && <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-border bg-white p-4">{bottom}</div>}
        </div>
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-white p-4">{aside}</aside>
      </div>
    </div>
  );
}
