# 08: Route highlight interactions

**What to build:** a reviewer hovers or keyboard-selects a Route in the list, and only that Route is highlighted on the canvas, which tells matching paths apart within their union. A toggle switches the canvas between "all, matches highlighted" and "matched only".

Spec: UI (canvas, state ownership, accessibility).

**Blocked by:** 03

**Status:** ready-for-agent

- [x] Hovering a Route highlights only its nodes and edges, and the rest of the matches dim
- [x] Clicking or keyboard-selecting a Route keeps the highlight until it's cleared
- [x] The hovered and selected Route live in the single Zustand UI store, so the list and canvas re-render only where needed. If the store doesn't exist yet (06 not landed), create it; if it does, extend it. There must never be two stores.
- [x] The "matched only" toggle hides nodes and edges that aren't matched
- [x] Route list keyboard support: Tab in, arrow keys move, Enter selects, Escape clears, focus is visible
- [x] Implementation note (architecture review, 2026-10-19): merge `lib/layout.ts` (`layoutTopDown`) and GraphCanvas's conversion to React Flow into one pure module in `lib`, e.g. `toFlowGraph(graph, routesResult?, activeRoute?) → { nodes, edges }`. It owns the dagre layout, node sizing, edge markers and highlight/dim state. Layout runs once per graph, and highlighting must not re-run it. GraphCanvas is left with just `<ReactFlow>`. Tests still go through the page seam.
- [x] Nodes and edges carry data attributes for their highlight state, so tests can check it
- [x] Tests (seam 3): hovering a Route marks only its nodes as highlighted, arrow-selecting with the keyboard highlights too, and the "matched only" toggle hides the other nodes
- [x] README reflects this ticket's behavior
