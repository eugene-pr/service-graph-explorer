# 21: Draggable nodes and MiniMap

**What to build:** users can drag nodes to untangle the graph and orient themselves with a MiniMap. Dragged positions survive Query changes. Research: `docs/research/graph-layout.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Nodes are draggable; dragging does not change selection unexpectedly
- [x] Dragged positions live in the single Zustand store and persist across Query changes
- [x] MiniMap shows the graph and the current viewport
- [x] Highlighting, matched-only hiding and keyboard selection unchanged
- [x] Page-level test (MSW) covers a drag keeping its position after a Query change
- [x] `pnpm verify` green
