# Service Graph Explorer

A REST API and React UI for querying Routes in a microservice graph.

Use Node.js 22 or newer and pnpm. Run `pnpm install`, then `pnpm dev` to start the API and web app. Run `pnpm verify` for typechecking, linting, tests and builds.

## Querying the API

Open `/docs` on the API server for interactive Swagger documentation. `GET /api/routes` runs a flat AND Query: `?filters=startsAtPublic,endsAtSink&endsAtSink.kinds=rds&limit=50`. Filter params are namespaced by Filter name; lists are comma-separated. Each Filter may appear once in GET. Use `POST /api/routes/query` for repeated Filters or nested `and` / `or` / `not` trees:

```json
{
  "query": {
    "and": [
      { "filter": "startsAtPublic" },
      { "filter": "passesThrough", "params": { "node": "frontend" } },
      {
        "or": [
          { "filter": "passesThrough", "params": { "node": "admin-basic-info-service" } },
          { "not": { "filter": "hasVulnerability", "params": { "minSeverity": "high" } } }
        ]
      }
    ]
  },
  "limit": 50
}
```

Each tree member has exactly one form: `{ filter, params? }`, `{ and: [...] }`, `{ or: [...] }` or `{ not: ... }`. AND requires every member, OR requires any member, and NOT negates its member. Repeated Filters keep their own params, so two `passesThrough` leaves in an AND require both nodes. An empty AND accepts every Route; an empty OR accepts none.

Both endpoints return `{ nodes, edges, routes, meta }`, with the union subgraph, exact Routes and `meta.effectiveQuery` showing the Query that ran. Unless a start-position Filter is a direct member of the top-level `and`, the engine adds `startsAtEntry`. A bare Filter, an `or` / `not` root, or a start Filter nested deeper still gets this default. Start candidates, end-node pruning and depth bounds use only direct Filter leaves in the top-level `and`; Filters inside `or` / `not` never constrain other branches. Filters select complete Routes of at least one edge ending at a node without outgoing edges. A Sink with outgoing edges cannot end a Route.

`limit` defaults to 100 and cannot exceed 1000. The engine looks for one extra matching Route to determine `meta.truncated`; `meta.routeCount` counts only returned Routes. All tree leaves are validated before searching, including branches that cannot match. Invalid Filter names, params, graph node names or Sink kinds return 400 RFC 7807 problem details. Filter errors name `filter`, `param` when applicable, and a `path` such as `query.and.0.or.1` locating the leaf in the submitted tree, before the Entry default is added. Equivalent flat GET and POST Queries return the same response.

## Exploring Routes

The default Query runs on first load and lists Routes starting at Entries. Run a Query using the Filter toggles and parameters on the left. The canvas initially shows the full graph, highlighting matched nodes and edges and dimming everything else.

- Hover a Route in the list to highlight just its nodes and consecutive edges. Other matches dim. Leaving restores the selected Route, or all matches if none is selected.
- Click a Route to keep it highlighted. Tab into the Route list, use Up/Down arrows to move focus and select a Route, and press Enter to select it. Selection persists when focus leaves the list. Focus has a visible outline, and selected Route buttons expose their pressed state to assistive technology.
- Press Escape in the Route list to clear the selection and hover preview and restore all matches.
- Enable **Matched only** to hide nodes and edges outside the Query's matches. Other matched Routes remain visible when one Route is selected. Disable it to return to the full graph. With no matches, this view has an empty canvas.

While a new Query runs, the previous Routes are labelled as updating and their highlight is removed until the current results arrive. Clicking a graph node still opens its details independently of Route selection.

When no Routes match, the Route list explains the empty result and suggests removing a Filter. Each active Filter has a hint showing how many Routes it matches on its own, using its current parameters and the current limit. These requests run in parallel through TanStack Query against the same `GET /api/routes` endpoint and share the normal Route cache. Counts marked **At least** were truncated by the limit; an unavailable count is labelled separately from zero. The engine's default Entry constraint still applies when a Filter does not set a starting position.

Click a hint to apply just that Filter, keeping its parameters, the limit and view mode. The URL, Query panel and results update together. Hints appear only for the current Query's confirmed empty result. With no active Filters, the empty state suggests choosing a start Filter instead. All empty-state copy applies to any graph file.

## State and rendering

TanStack Query owns graph, Filter Catalog and Route data. The single Zustand UI store holds the selected node and the identities of hovered and selected Routes. Components subscribe to the fields they use, so Route hover updates the canvas without rerendering the Query panel or page.

The URL owns the current flat Query and view mode, through a single Query hook. **Run** writes Filters, params and limit to the URL; **Matched only** writes the view mode immediately. Bookmark or share the URL to reopen and run that Query. Browser Back and Forward restore Queries and their view modes. Reset returns to the default Query and full graph.

The format matches `GET /api/routes`: `filters` is a comma-separated list, params use `<filter>.<param>`, and array params are comma-separated. `limit` defaults to 100 (maximum 1000). `view=matched` shows only matches; omitted or `view=full` shows the full graph. For example:

```text
/?filters=endsAtSink,hasVulnerability&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high&limit=50&view=matched
```

URL values are validated with the shared domain schemas and Filter Catalog. Unknown Filters or params, invalid values, and duplicate query-string keys fall back to the whole default Query and full graph, with a short non-blocking notice. The original URL remains available for correction; changing the Query, resetting it or changing the view mode writes a fresh URL. Running the unchanged default Query retries it without rewriting the invalid URL. Node names and Sink kinds are checked against the loaded graph by the API, with errors shown in the Route list.

The current Query has no component or Zustand copy. The Query panel keeps only unsubmitted form edits locally; they become the current Query on Run, and browser navigation to another Query replaces them. Run validates these edits first: invalid parameters show an error in the panel while preserving the draft, active Query, results and browser history for correction.

The pure `lib/toFlowGraph.ts` module owns dagre layout, React Flow conversion, node sizing, edge markers and highlight state. It caches layout per graph object, so Query results, Route interactions and view changes reuse the same positions. Nodes and edges expose `data-highlighted` for page-level tests, which render the real canvas against an API mocked with MSW.
