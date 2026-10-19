# 20: Readable graph layout on first load

**What to build:** the graph opens at a legible zoom. Layout orientation (top-to-bottom or left-to-right) is chosen from the canvas aspect ratio instead of always top-to-bottom, so the real graph is no longer shrunk into an unreadable strip. Research: `docs/research/graph-layout.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Layout is a pure, deterministic function of the graph and the canvas aspect ratio; no framework imports
- [x] On a wide canvas the real graph (47 nodes) lays out with an aspect ratio near the canvas's, not ~6:1
- [x] Layout is recomputed (and the view refit) when the canvas aspect ratio crosses the orientation threshold
- [x] Highlighted Routes, selection and keyboard navigation behave as before
- [x] Tests at the engine-free seams: layout function unit test, and `ExplorerPage` test still green
- [x] `pnpm verify` green
