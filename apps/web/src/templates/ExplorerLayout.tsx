import type { ReactNode } from 'react';

interface ExplorerLayoutProps {
  banner?: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
}

export function ExplorerLayout({ banner, sidebar, main }: ExplorerLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-2">
        <h1 className="text-base font-semibold">Service Graph Explorer</h1>
      </header>
      {banner}
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">{sidebar}</aside>
        <main className="relative min-w-0 flex-1">{main}</main>
      </div>
    </div>
  );
}
