# Spec: Service Graph Explorer

Status: ready-for-agent

## Problem Statement

A security reviewer has a graph of the Train Ticket microservices: services, data stores and queues, and the calls between them, with some services publicly exposed and some carrying known vulnerabilities. They need to answer questions like "which Routes start at a public service, pass through a vulnerable node and end at a Sink?". Today the graph is only a raw JSON file, with no way to query, filter or see Routes, and no easy way to ask new kinds of questions without new code each time.

Backslash (the hiring company) is also evaluating the candidate. They expect a REST API that returns a graph that's easy to render, a usable React UI on top of it (no mock given, on purpose), a README design doc, and evidence that the design is "as generic as possible", so new Filters are cheap to add.

## Solution

A TypeScript monorepo with three parts:

- **API (Fastify):** loads and validates the graph at startup, and serves the full graph, the Filter Catalog, and Query results. A Query is either a flat AND list of Filters in query-string form, or an `and`/`or`/`not` tree sent in a JSON body. Results contain the matching Routes, the subgraph made of their union, and metadata (count, truncation, warnings). Swagger docs are generated from the schemas.
- **Web UI (React):** an explorer that shows the whole graph laid out top-down, a Query panel generated from the Filter Catalog, a Route list, and node details. Matched Routes are highlighted, everything else is dimmed, and the Query lives in the URL.
- **Shared domain package:** types, zod schemas and the Filter Catalog metadata used by both sides. The Route engine and Filter checks live only in the API, which is the single source of truth.

The README is the design doc: data issues found, assumptions, the reasoning behind each decision, how to add a Filter, and how the design scales.

## User Stories

### Exploring the graph
1. As a security reviewer, I want to see the whole service graph when I open the UI, so that I get my bearings before querying.
2. As a security reviewer, I want the graph laid out top-down from Entries to Sinks, so that call direction reads naturally.
3. As a security reviewer, I want public services to carry a visible badge, so that I can spot entry points at a glance.
4. As a security reviewer, I want vulnerable nodes to carry a badge colored by highest severity, so that I can see where the risk is.
5. As a security reviewer, I want Sinks drawn with a distinct shape, so that data stores and queues stand out from services.
6. As a security reviewer, I want Inferred Nodes drawn with a dashed border, so that I know they were not in the source data.
7. As a security reviewer, I want a legend explaining badges and shapes, so that I can read the graph without guessing.
8. As a security reviewer, I want to pan and zoom the graph, so that I can inspect dense areas.
9. As a security reviewer, I want to click a node to see its details (kind, language, path, publicExposed, vulnerabilities with file, severity, message and CWE), so that I can understand why it matters.
10. As a security reviewer, I want a "show Routes through here" action in node details, so that I can ask "what reaches this node?" with one click.

### Querying
11. As a security reviewer, I want to toggle Filters on and off in a panel, so that I can build a Query without writing syntax.
12. As a security reviewer, I want to filter Routes that start at a public service, so that I can focus on what an external attacker can reach.
13. As a security reviewer, I want to filter Routes that end at a Sink, so that I can find paths to data stores and queues.
14. As a security reviewer, I want to choose which node kinds count as Sinks, so that I can narrow to databases only, or include queues.
15. As a security reviewer, I want to filter Routes that pass through a vulnerable node, so that I can find Routes that can be exploited.
16. As a security reviewer, I want to set a minimum severity on the vulnerability Filter, so that I can ignore low-risk findings.
17. As a security reviewer, I want to filter Routes that pass through a specific node, so that I can study the blast radius around it.
18. As a security reviewer, I want to cap Route length in hops, so that I can focus on short, likely attack paths.
19. As a security reviewer, I want to combine Filters, and get only Routes matching all of them, so that I can find toxic combinations.
20. As a power user, I want an advanced mode to build `and`/`or`/`not` trees, so that I can express Queries a flat list can't.
21. As a security reviewer, I want parameter inputs validated before the Query is sent, so that I get immediate, clear feedback.
22. As a security reviewer, I want to reset the Query to the default view, so that I can start over quickly.
23. As a security reviewer, I want the default view (no start Filter) to show Routes starting at Entries, so that I see complete flows, not every possible tail.

### Results
24. As a security reviewer, I want matched Routes highlighted and everything else dimmed, so that I see results in context.
25. As a security reviewer, I want a toggle to show only the matched subgraph, so that I can declutter large results.
26. As a security reviewer, I want a list of matched Routes as node chains, so that I can read each one exactly.
27. As a security reviewer, I want hovering or selecting a Route in the list to highlight just that Route in the graph, so that I can tell matching paths apart from the union.
28. As a security reviewer, I want to see the Route count, so that I know how big the result is.
29. As a security reviewer, I want to be told when results were truncated by the limit, so that I don't think I'm seeing everything.
30. As a security reviewer, I want an explanatory empty state when nothing matches, showing how many Routes each active Filter matches on its own, so that I can see which Filter to drop and an empty result isn't mistaken for a bug.
31. As a security reviewer, I want data warnings from loading (e.g. the Inferred Node) visible in the UI, so that I can trust the data while knowing its gaps.
32. As a security reviewer, I want loading and error states shown clearly, so that I know what the app is doing.

### Sharing
33. As a security reviewer, I want the current Query encoded in the URL, so that I can bookmark and share a view.
34. As a security reviewer, I want an invalid or stale URL to fall back to defaults instead of crashing, so that shared links are robust.

### API consumers
35. As an API consumer, I want to fetch the full graph as nodes and edges, so that I can render it in any client.
36. As an API consumer, I want to list the Filter Catalog with names, descriptions, position and params as JSON Schema, so that I can build UIs or clients generically.
37. As an API consumer, I want to run a flat AND Query through query-string params, so that simple Queries are easy to curl and bookmark.
38. As an API consumer, I want to run a nested `and`/`or`/`not` Query through a JSON body, so that I can express complex Queries.
39. As an API consumer, I want each Filter's params namespaced by Filter name in the query string, so that params never collide.
40. As an API consumer, I want a result with `nodes`, `edges`, `routes` and `meta`, so that I can both render and reason about exact matches.
41. As an API consumer, I want a `limit` param with a sensible default and maximum, so that responses stay bounded.
42. As an API consumer, I want RFC 7807 error responses that name the bad Filter or param, so that I can fix requests quickly.
43. As an API consumer, I want interactive OpenAPI docs, so that I can explore and try the API without reading code.
44. As an operator, I want a health endpoint, so that Docker and CI can check that the service is up.

### Data loading
45. As an operator, I want to point the API at a different graph file through an env var, so that I can analyze other graphs or fixtures.
46. As an operator, I want startup to fail fast with clear validation errors on invalid data, so that bad data never serves wrong answers.
47. As an operator, I want edges whose `to` is a single string or an array both accepted, so that the provided data loads as-is.
48. As an operator, I want edge targets missing from `nodes` turned into Inferred Nodes with a warning, so that the data's intended shape is kept and the gap is visible.
49. As an operator, I want unknown vulnerability severities mapped to `unknown` with a warning instead of crashing, so that new severities in the data don't take the service down.

### Developers / reviewers
50. As a developer, I want to add a Filter by writing its metadata in the domain package and its check in the API, with the compiler flagging a missing half, so that extending the system is safe and cheap.
51. As a developer, I want a new Filter to appear automatically in the API docs and the UI's Query panel, so that extending needs no UI work.
52. As a reviewer, I want to run everything with one command after install, so that I can evaluate quickly.
53. As a reviewer, I want `docker compose up` to serve the API and UI on one port, so that I need nothing but Docker.
54. As a reviewer, I want a CI badge showing typecheck, lint and tests passing, so that I trust the code works.
55. As a reviewer, I want a README that explains data issues, assumptions, decisions, state ownership, how to add a Filter and how it scales, so that I can judge the reasoning, not just the code.
56. As a reviewer, I want a test fixture where all three required Filters match together, so that I can see the combination work even though the real data yields nothing.
57. As a security reviewer, I want the default Query to run when the page opens, so that the Route list is populated right away.
58. As a keyboard user, I want the Query panel and Route list fully usable by keyboard with visible focus, so that I can work without a mouse.
59. As a color-blind user, I want badges to carry text labels as well as color, so that severity and status are readable without relying on color alone.
60. As an API consumer, I want a 400 when I reference a node or sink kind that doesn't exist in the graph, so that a typo isn't silently treated as "no results".

## Implementation Decisions

### Domain language
- The terms are defined in `CONTEXT.md`: **Route**, **Entry**, **Sink**, **Inferred Node**, **Filter**, **Filter Catalog**, **Query**. Use them in code, API and UI copy.
- **Route:** a simple path (no repeated node) of at least one edge, from any node to a node with no outgoing edges. Filters only select among Routes; they never change which Routes exist.
- **Default view:** when no direct member of the Query's top-level `and` is a start-position Filter, the engine wraps the Query as `and(startsAtEntry, <query>)`. A bare Filter or an `or`/`not` root counts as having no top-level start Filter. Start Filters nested inside `or`/`not` don't count, which keeps the rule predictable and matches the pruning rule. The default is explicit: the Query the engine actually ran is returned in `meta.effectiveQuery`, and the UI tree builder shows it.
- **Sink:** any node whose kind is in the configured sink kinds. The default is every kind except `service` (in this data: `rds`, `sqs`). The task's "rds/sql" is assumed to mean `rds` plus the `sqs` in the data; the README documents this.
- **Known limitation:** a Sink with outgoing edges can never be a Route's last node. Both Sinks in this data have no outgoing edges. Document this in the README.

### Modules
- **Domain package (shared):** graph types (node, edge, vulnerability, severity), zod schemas for the raw input file and the normalized graph, schemas for Query (flat and tree), query result and error responses, and the Filter Catalog metadata (name, description, position: start / end / any / route, params schema). It has no runtime dependencies beyond zod, and both the API and the web app import its source directly, with no build step during development.
- **Graph loader (API):** turns raw JSON into a normalized graph plus warnings:
  - normalizes `to` from a string to an array
  - creates Inferred Nodes (kind `service`, `inferred: true`) for missing targets
  - fails fast on duplicate node names
  - merges duplicate edges, with a warning
  - maps unknown severities to `unknown`
  - builds forward and reverse adjacency
  - fails fast with zod errors on structurally invalid input

  The source is the bundled data file by default, or the `GRAPH_FILE` env var.
- **Route engine (API):** a deep module with a small interface, a function that runs a Query against a graph with a limit, returning nodes, edges, routes and meta.
  - Search: DFS over simple paths, only from start candidates. Start candidates come from start-position Filters that are direct members of the top-level `and`; otherwise every node, then filtered.
  - Pruning: when the top-level `and` has end-position Filters, precompute the nodes that can reach a matching end node (reverse BFS) and skip branches that can't. `maxLength` in the top-level `and` also bounds depth.
  - Filters inside `or`/`not` are never used for pruning, so pruning can't change results.
  - Search order is deterministic: start candidates and neighbors follow source-data order. With a limit, the same Query always returns the same Routes, pruned or not.
  - Search for `limit + 1` matching Routes. Return the first `limit`, and set `meta.truncated` only if the extra Route exists. `meta.routeCount` is the number of Routes returned, never an estimated total.
  - Cycles are handled by the simple-path rule.
- **Validation against the graph (API):** the static schemas in the domain package check shape only. A second step checks params against the loaded graph: `passesThrough.node` must name an existing node, and each `endsAtSink.kinds` value must be a kind present in the graph. Failures are 400 errors in RFC 7807 format, naming the Filter and param.
- **Filter implementations (API):** one check per Filter, run against a Route and its graph. The implementation map is typed against the Filter Catalog's names, so a Filter missing its metadata or its check is a compile error. `and`/`or`/`not` combine checks.
- **HTTP layer (API):** Fastify with zod type providers, OpenAPI generated from the schemas, Swagger UI, RFC 7807 errors, static serving of the built web app in production.
- **Web app:** React + Vite + Tailwind, React Flow (`@xyflow/react`) with dagre layout, TanStack Query, Zustand, and a Vite dev proxy for `/api`.

### Filter Catalog (v1)
| Filter | Position | Params | Note |
|---|---|---|---|
| `startsAtEntry` | start | none | added automatically when a Query has no start-position Filter |
| `startsAtPublic` | start | none | required by task |
| `endsAtSink` | end | `kinds: string[]` (default: every kind except `service`) | required by task |
| `hasVulnerability` | any | `minSeverity?: low \| medium \| high \| critical` | required by task; param is extra |
| `passesThrough` | any | `node: string` (must exist) | backs "show Routes through here" |
| `maxLength` | route | `hops: number` (≥1) | shows a check over the whole Route |

Severity order: `unknown` < `low` < `medium` < `high` < `critical`. With no `minSeverity`, `hasVulnerability` matches a node with any vulnerability, including `unknown`. With a `minSeverity`, `unknown` never satisfies it.

### API contract
- `GET /api/graph`: the full graph `{ nodes, edges, meta: { warnings } }`.
- `GET /api/filters`: the Filter Catalog, with each Filter's params as JSON Schema.
- `GET /api/routes?filters=a,b&<filter>.<param>=…&limit=N`: a flat AND Query. Params are namespaced by Filter name, and list params are comma-separated. A Filter can't appear twice in this form; repeated Filters need the POST endpoint (documented).
- `POST /api/routes/query`: body `{ query, limit? }`. `query` is a recursive tree: a Filter leaf `{ filter, params? }`, `{ and: [...] }`, `{ or: [...] }` or `{ not: ... }`.
- **Result:** `{ nodes, edges, routes, meta }`.
  - `nodes`: `{ id, data }`, where data is the full node (kind, language, path, publicExposed, vulnerabilities, inferred).
  - `edges`: `{ id, source, target }`, the union of the matched Routes.
  - `routes`: arrays of node ids.
  - `meta`: `{ routeCount, truncated, limit, effectiveQuery, warnings }`.
- `limit`: default 100, max 1000.
- **Errors:** RFC 7807 `{ type, title, status, detail, errors[] }`. Each entry in `errors` names the Filter and param. These return 400: an unknown Filter, a bad param shape, a param that doesn't match the graph (unknown node or sink kind), and a limit over the maximum.
- `GET /health` and `GET /docs` (Swagger UI).
- Everything except health and docs lives under `/api`, so the web app is served from `/`.

### UI
- **Layout:** the Query panel on the left (Filter toggles with generated param inputs, run/reset, legend), the graph canvas in the center, the Route list on the right, and node details at the bottom.
- **Canvas:** shows the full graph from `/api/graph`. Query results highlight matched nodes and edges and dim the rest, with a "matched only" toggle. Hovering or selecting a Route highlights only that Route.
- **Node visuals:** a public badge, a severity-colored vulnerability badge, a distinct shape for Sinks, and a dashed border for Inferred Nodes.
- **Query panel:** generated from the Filter Catalog's metadata and validated with the shared schemas before sending.
- **Advanced mode:** a tree builder for `and`/`or`/`not` that posts to the Query endpoint.
- **First load:** the default Query (Routes from Entries) runs when the page opens, so the Route list starts populated.
- **Empty state:** a generic explanation plus "try removing a Filter" hints showing each active Filter's Route count on its own. The UI fires those Queries in parallel. Facts about this particular data live only in the README, never in UI copy, so the UI stays correct under `GRAPH_FILE`.
- **Accessibility:**
  - the Query panel, Route list and node details are usable by keyboard (Tab and arrow keys), with visible focus
  - the Route list supports keyboard selection that highlights the Route like hover does
  - each badge has a text label (e.g. "public", "high"), never color alone
  - interactive controls have accessible names
- **State ownership** (one home per kind of state; also stated in the README):
  - server data (graph, Filter Catalog, Routes) lives in TanStack Query
  - the Query (Filters, params, limit, view mode) lives in the URL, validated by the shared schemas, with invalid values falling back to defaults
  - the advanced tree is JSON encoded with URL-safe base64 (base64url) in a `q` param
  - short-lived UI state (selected node, hovered Route, open panels) lives in a Zustand store
- **Atomic Design:**
  - atoms (Button, Badge, Icon, Toggle, Input, Select, Spinner)
  - molecules (SeverityBadge, FilterToggle, RouteChip, LegendItem)
  - organisms (QueryPanel, GraphCanvas, ServiceNode, RouteList, NodeDetails, QueryTreeBuilder)
  - templates (ExplorerLayout: slots only)
  - pages (ExplorerPage: connects data to the template)
  - Plus hooks, API client, store and lib (dagre layout, Route-to-highlight mapping) alongside.
  - Atoms and molecules are presentational only, with no fetching and no store access.
  - An ESLint import-boundary rule makes sure a lower layer never imports a higher one.

### Monorepo and delivery
- pnpm workspaces (via corepack), no task runner: an API app, a web app and a domain package. Root scripts: dev (both apps in parallel), build, test, lint, typecheck. Node 22, ESM, `tsx` in dev, `tsc` for builds.
- GitHub Actions CI runs typecheck, lint and test on push and PR, with a badge in the README.
- A multi-stage Dockerfile plus Docker Compose: one container in which Fastify serves the API and the built web app on one port.

### Build order / cut line
1. **Day 1–2 (minimum submittable version):**
   - domain package
   - loader + engine, test-first
   - API endpoints
   - basic UI: graph, Query panel, Route list
2. **Day 3:** UI polish, node details with "show Routes through here", URL state, README.
3. **Day 4:** CI, Docker, advanced tree builder.
4. **Day 5:** buffer, Playwright E2E, Storybook (optional; cut first).

## Testing Decisions

- **Good tests check external behavior through public interfaces only:** given this graph and this Query, these Routes come back. Never assert on internal helpers, search order or private data structures. Tests should survive a rewrite of the internals.
- **Seam 1, the engine interface (main seam):** the graph loader and the Query function, with plain-data inputs. Write these test-first. Cover:
  - the mixed `to` field
  - Inferred Node creation and its warning
  - unknown severity mapping
  - invalid input failing
  - every Filter and its params
  - `and`/`or`/`not`
  - the added `startsAtEntry` default: added for a bare Filter and for `or`/`not` roots, not added when the top-level `and` already has a start Filter, and reflected in `effectiveQuery`
  - `hasVulnerability` without `minSeverity` matching `unknown`
  - duplicate node names failing, duplicate edges merged with a warning
  - cycles
  - `limit` and `truncated`: exactly `limit` Routes means not truncated, `limit + 1` means truncated, and repeated runs return the same Routes
  - pruned and unpruned search returning the same Routes, including Queries where end Filters sit inside `or`/`not`
  - a handmade fixture where `startsAtPublic` + `endsAtSink` + `hasVulnerability` all match
  - the real data returning an empty result for all three combined
- **Seam 2, the HTTP interface:** the Fastify app through `inject()`, covering only HTTP concerns:
  - query-string and body parsing, and namespaced params
  - 400 responses in RFC 7807 format for an unknown Filter, bad params, an unknown `passesThrough` node, an unknown sink kind and an over-limit request
  - `GET` and `POST` returning the same result for equivalent flat Queries
  - `/api/filters` exposing the Filter Catalog
  - `/health`
  - one snapshot test of the real data

  Filter logic is not re-tested here.
- **Seam 3, the UI page interface:** `ExplorerPage` rendered with React Testing Library against an API mocked with MSW. Cover:
  - toggling a Filter sends the right request and lists Routes
  - hovering a Route marks it highlighted (assert on data attributes and the Route list, not canvas pixels)
  - node details and "show Routes through here"
  - the default Query running on first load
  - the empty state, with each Filter's count on its own
  - the Query written to and read from the URL (including a base64url `q` tree), with an invalid URL falling back to defaults
  - warnings shown
  - keyboard: Tab into the Route list, arrow-select a Route, and it gets highlighted

  Add organism-level tests only where the page level can't reach, mainly the tree builder.
- **Optional E2E:** one or two Playwright smoke tests against the real server: load the page, toggle a Filter, see highlighted Routes.
- **Domain package:** no seam of its own; its schemas are tested through seams 1 and 3.
- **Prior art:** none. This is a new repo, and these tests set the conventions.
- **Tooling:** vitest everywhere. A test that registers a new Filter in a fixture shows that extending needs no engine or HTTP changes.

## Out of Scope

- A database, persistence, or changing the graph at runtime (no upload endpoint)
- Authentication or multiple tenants
- GraphQL, or any query language beyond the `and`/`or`/`not` tree
- Precomputed indexes or a graph database (README mentions them only as the scaling path)
- A Sink with outgoing edges ending a Route (documented limitation)
- Repeated Filters in the `GET` form (use the POST endpoint)
- A deployed hosted demo (optional extra only if time is left)
- Emailing Backslash with questions: every ambiguity becomes a documented README assumption instead

## Further Notes

- **Data findings for the README:**
  - The public nodes are `frontend` and `gateway-service`. `gateway-service` is isolated, and `frontend` reaches only the `admin-basic-info-service` subtree, so the three required Filters combined return nothing.
  - `assurance-service` is referenced but not defined.
  - One edge has a string `to`.
  - One vulnerability's message describes SQL injection, but its CWE says path traversal.
  - Every service is Java.
  - The severities present are `medium` and `high`.
  - There are no cycles.
  - There are 13 Entries and 5 isolated nodes.
- **Research:** the attack-path research notes in the docs folder back the design. Backslash's "toxic code flows", Defender's entry point → vulnerable node → target, and CodeQL sources/sinks/barriers all map onto start / end / any-node Filters combined with AND by default.
- **Assignment context:** the original assignment plus the email requirements are in `TASK.md`. The UI is required and will be judged without a mock, so polish and UX reasoning matter.
