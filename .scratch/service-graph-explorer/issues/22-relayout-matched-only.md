# 22: Relayout visible nodes when matched-only is on

**What to build:** turning on matched-only re-lays out just the visible nodes and refits the view, so matched Routes fill the viewport instead of floating in the old gaps. Dragged positions are reset on relayout. Research: `docs/research/graph-layout.md`.

**Blocked by:** 20, 21

**Status:** ready-for-agent

- [x] With matched-only on, layout runs over matched nodes and edges only
- [x] View is refit explicitly after the relayout
- [x] Toggling matched-only off restores the full-graph layout
- [x] Dragged positions are cleared on relayout (either direction)
- [x] Page-level test (MSW) covers the toggle and a cleared drag
- [x] `pnpm verify` green
- [x] ELK deferred: only revisit if the graph is still unreadable after 20–22
