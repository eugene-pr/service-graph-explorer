# 03: First Query end to end

**What to build:** a reviewer opens the Query panel, sees the available Filters (generated from the Filter Catalog), turns on "starts at public", runs it, and sees matching Routes listed and highlighted on the canvas, with everything else dimmed. With no start Filter, Routes from Entries are shown. This sets up the Route engine, the Filter Catalog mechanism, the Query API, error handling and the API docs.

Spec: Domain language (Route, default view), Modules → Route engine / Filter implementations / HTTP layer, Filter Catalog, API contract, UI (layout, state ownership).

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Each Filter Catalog entry in the domain package has name, description, position (start / end / any / route) and a params schema
- [x] Filters are implemented in the API through a map typed against the catalog's names, so a Filter missing either its metadata or its check fails to compile
- [x] The loader returns a Graph module, not a plain object of arrays. It provides node lookup by name, forward and reverse adjacency (in source-data order), the kinds present, the warnings and the `GET /api/graph` response shape. The engine, graph validation and Filters all use it instead of building their own lookups (architecture review, 2026-10-19).
- [x] Engine: a Route is a simple path of at least one edge that ends at a node with no outgoing edges
  - search starts from the candidates given by start Filters that are direct members of the top-level `and`
  - cycles are safe
- [x] Search order is deterministic: start candidates and neighbors follow source-data order
- [x] The engine finds `limit + 1` Routes, returns `limit`, and sets `truncated` only if the extra one exists. `routeCount` is the number returned. `limit` defaults to 100, max 1000.
- [x] Default view: if the top-level `and` has no start Filter as a direct member, the Query becomes `and(startsAtEntry, query)`; this is reported in `meta.effectiveQuery`
- [x] Filters `startsAtEntry` and `startsAtPublic` work
- [x] `GET /api/filters` returns the catalog, with params as JSON Schema
- [x] `GET /api/routes?filters=…&<filter>.<param>=…&limit=N` returns `{ nodes, edges, routes, meta: { routeCount, truncated, limit, effectiveQuery, warnings } }`
- [x] Errors use RFC 7807: unknown Filter, bad param shape and over-limit return 400, and each error names the Filter and param
- [x] OpenAPI is generated from the zod schemas; Swagger UI is served at `/docs`
- [x] UI layout: Query panel on the left, canvas in the center, Route list on the right (a template with slots and a page that connects the data)
- [x] The Query panel is generated from the Filter Catalog, with toggles, param inputs generated from the params schema, and run and reset buttons
- [x] The Route list shows each Route as a node chain, plus the count and a truncation notice
- [x] Matched nodes and edges are highlighted on the canvas, the rest dimmed
- [x] Server data goes through TanStack Query
- [x] The current Query is read and changed only through one hook, with the same interface ticket 09 will use (read the Query, set Filters, params and limit, reset). Here it's backed by local state; 09 switches it to the URL without changing any callers.
- [x] Tests (seam 1):
  - the Graph module's lookups and adjacency, through the loader
  - Route definition, cycles, `startsAtEntry` added for an empty Query and for flat Queries with no start Filter, not added when a start Filter is a direct member (`or`/`not` roots are tested in 11)
  - deterministic order
  - exactly `limit` Routes means not truncated, `limit + 1` means truncated
- [x] Tests (seam 2): query-string parsing, 400 cases in RFC 7807 format, `/api/filters`
- [x] Tests (seam 3): toggling `startsAtPublic` sends the right request and lists Routes
- [x] Test: registering a fixture Filter needs no engine or HTTP changes
