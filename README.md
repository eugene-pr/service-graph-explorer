# Service Graph Explorer

A REST API and React UI for querying Routes in a microservice graph.

Use Node.js 22 or newer and pnpm. Run `pnpm install`, then `pnpm dev` to start the API and web app. Run `pnpm verify` for typechecking, linting, tests and builds.

## Exploring Routes

The default Query runs on first load and lists Routes starting at Entries. Run a Query using the Filter toggles and parameters on the left. The canvas initially shows the full graph, highlighting matched nodes and edges and dimming everything else.

- Hover a Route in the list to highlight just its nodes and consecutive edges. Other matches dim. Leaving restores the selected Route, or all matches if none is selected.
- Click a Route to keep it highlighted. Tab into the Route list, use Up/Down arrows to move focus and select a Route, and press Enter to select it. Selection persists when focus leaves the list. Focus has a visible outline, and selected Route buttons expose their pressed state to assistive technology.
- Press Escape in the Route list to clear the selection and hover preview and restore all matches.
- Enable **Matched only** to hide nodes and edges outside the Query's matches. Other matched Routes remain visible when one Route is selected. Disable it to return to the full graph. With no matches, this view has an empty canvas.

While a new Query runs, the previous Routes are labelled as updating and their highlight is removed until the current results arrive. Clicking a graph node still opens its details independently of Route selection.

## State and rendering

TanStack Query owns graph, Filter Catalog and Route data. The single Zustand UI store holds the selected node and the identities of hovered and selected Routes. Components subscribe to the fields they use, so Route hover updates the canvas without rerendering the Query panel or page.

The URL owns the current flat Query and view mode, through a single Query hook. **Run** writes Filters, params and limit to the URL; **Matched only** writes the view mode immediately. Bookmark or share the URL to reopen and run that Query. Browser Back and Forward restore Queries and their view modes. Reset returns to the default Query and full graph.

The format matches `GET /api/routes`: `filters` is a comma-separated list, params use `<filter>.<param>`, and array params are comma-separated. `limit` defaults to 100 (maximum 1000). `view=matched` shows only matches; omitted or `view=full` shows the full graph. For example:

```text
/?filters=endsAtSink,hasVulnerability&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high&limit=50&view=matched
```

URL values are validated with the shared domain schemas and Filter Catalog. Unknown Filters or params, invalid values, and duplicate query-string keys fall back to the whole default Query and full graph, with a short non-blocking notice. The original URL remains available for correction; Run, Reset or a view change writes a fresh URL. Node names and Sink kinds are checked against the loaded graph by the API, with errors shown in the Route list.

The current Query has no component or Zustand copy. The Query panel keeps only unsubmitted form edits locally; they become the current Query on Run, and browser navigation to another Query replaces them.

The pure `lib/toFlowGraph.ts` module owns dagre layout, React Flow conversion, node sizing, edge markers and highlight state. It caches layout per graph object, so Query results, Route interactions and view changes reuse the same positions. Nodes and edges expose `data-highlighted` for page-level tests, which render the real canvas against an API mocked with MSW.
