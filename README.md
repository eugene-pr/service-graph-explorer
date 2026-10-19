# Service Graph Explorer

A REST API and React UI for querying Routes in a microservice graph.

Use Node.js 22 or newer and pnpm. Run `pnpm install`, then `pnpm dev` to start the API and web app. Run `pnpm verify` for typechecking, linting, tests and builds.

## Exploring Routes

The default Query lists Routes starting at Entries. Run a Query using the Filter toggles and parameters on the left. The canvas initially shows the full graph, highlighting matched nodes and edges and dimming everything else.

- Hover a Route in the list to highlight just its nodes and consecutive edges. Other matches dim. Leaving restores the selected Route, or all matches if none is selected.
- Click a Route to keep it highlighted. Tab into the Route list, use Up/Down arrows to move focus and select a Route, and press Enter to select it. Selection persists when focus leaves the list. Focus has a visible outline, and selected Route buttons expose their pressed state to assistive technology.
- Press Escape in the Route list to clear the selection and hover preview and restore all matches.
- Enable **Matched only** to hide nodes and edges outside the Query's matches. Other matched Routes remain visible when one Route is selected. Disable it to return to the full graph. With no matches, this view has an empty canvas.

While a new Query runs, the previous Routes are labelled as updating and their highlight is removed until the current results arrive. Clicking a graph node still opens its details independently of Route selection.

## State and rendering

TanStack Query owns graph, Filter Catalog and Route data. The single Zustand UI store holds the selected node and the identities of hovered and selected Routes. Components subscribe to the fields they use, so Route hover updates the canvas without rerendering the Query panel or page.

The Query hook owns the current Query and the Matched only view mode. They currently use local state; URL persistence is planned in ticket 09. Reset returns the view mode to the full graph.

The pure `lib/toFlowGraph.ts` module owns dagre layout, React Flow conversion, node sizing, edge markers and highlight state. It caches layout per graph object, so Query results, Route interactions and view changes reuse the same positions. Nodes and edges expose `data-highlighted` for page-level tests, which render the real canvas against an API mocked with MSW.
