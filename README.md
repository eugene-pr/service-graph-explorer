# Service Graph Explorer

A REST API and React UI for querying Routes in a microservice graph. The API loads the Train Ticket graph, runs Queries (Filters combined with `and` / `or` / `not`) and returns the matching Routes with their union subgraph. The UI shows the whole graph, highlights the matched Routes and keeps the Query in the URL.

A TypeScript pnpm monorepo: `apps/api` (Fastify, Route engine, Filter checks), `apps/web` (React, Vite, React Flow) and `packages/domain` (types, zod schemas and Filter Catalog metadata shared by both). Domain terms (Route, Entry, Sink, Inferred Node, Filter, Filter Catalog, Query) are defined in [`CONTEXT.md`](CONTEXT.md).

## Running it

Use Node.js 22 or newer (`.nvmrc`) and pnpm through corepack:

```sh
corepack enable && pnpm i && pnpm dev
```

`pnpm dev` starts the API on http://localhost:3000 and the web app on http://localhost:5173, which proxies `/api` and `/health` to the API. Swagger UI is at http://localhost:3000/docs.

With only Docker:

```sh
docker compose up
```

One container serves the UI at http://localhost:3000, the API under `/api`, Swagger at `/docs` and health at `/health`. `PORT=8080 docker compose up` changes the host port.

The API reads the bundled `data/train-ticket-be.json` unless `GRAPH_FILE` names another graph file. In Docker, put the file in `./data` and run `GRAPH_FILE=/graphs/<file>.json docker compose up`. Outside Docker, use an absolute path. An invalid file stops startup with the validation errors. Outside Docker, `WEB_DIST=<absolute path to apps/web/dist>` makes the API serve the built UI too.

Other commands:

- `pnpm verify`: typecheck, lint, test and build. CI runs typecheck, lint and test on every push and PR.
- `pnpm e2e`: builds, then runs Playwright against the production build (API on :3100, `vite preview` on :4180; both must be free). Run `pnpm --filter @sge/e2e exec playwright install chromium` once first. Covers a hover smoke test, each Filter with its params through run, reload and reset, invalid params, and the empty state of the three required Filters. Not part of `pnpm verify` or CI.
- `pnpm storybook`: atoms and molecules at http://localhost:6006. `pnpm build-storybook` writes `apps/web/storybook-static/`.

## Data findings

Found in `data/train-ticket-be.json` (46 nodes, 27 edge entries):

- **The three required Filters combined return nothing.** `startsAtPublic` + `endsAtSink` + `hasVulnerability` matches no Route. The only public nodes are `frontend` and `gateway-service`. `gateway-service` has no edges, and `frontend` reaches only the `admin-basic-info-service` subtree, which contains no Sink and no vulnerable node. Even `startsAtPublic` + `endsAtSink` is empty. Each one alone does match: `startsAtPublic` 5 Routes, `endsAtSink` 33, `hasVulnerability` 60, and `endsAtSink` + `hasVulnerability` 30 (try them below). The UI explains empty results and shows how many Routes each Filter matches on its own. An engine test runs all three together on a small graph where they do match.
- **`assurance-service` is missing from `nodes`.** `preserve-service` and `preserve-other-service` call it. The loader adds it as an Inferred Node (kind `service`, `inferred: true`) with a warning, shown in the UI and in `meta.warnings`.
- **One edge has a string `to`:** `consign-service` → `"consign-price-service"`. Every other `to` is an array. Both forms are accepted.
- **Vulnerability messages and CWEs disagree.** The `medium` findings on `auth-service` and `order-service` describe SQL injection, but their CWE is CWE-22 (Path Traversal). Data is shown as given.
- **Every service is Java.** `language` carries no information here. The Sinks have no language.
- **No cycles.** The engine still handles cycles through the simple-path rule.
- Other facts: severities present are `medium` and `high`. Sinks are `prod-postgresdb` (`rds`) and `prod-sqs` (`sqs`), both with no outgoing edges. There are 18 Entries (no incoming edges), 5 of them isolated nodes with no edges at all.

## Assumptions

- **Route:** a simple path (no repeated node) of at least one edge, from any node to a node with no outgoing edges. Filters only select among Routes; they never change which Routes exist.
- **Default view:** a Query with no start-position Filter would return every tail of every flow. Unless a start-position Filter is a direct member of the top-level `and`, the engine runs `and(startsAtEntry, <query>)`, so the default shows complete flows from Entries. The Query that ran is returned in `meta.effectiveQuery`.
- **Sink "(rds/sql)":** the data has no `sql` kind; its non-service nodes are `prod-postgresdb` (`rds`) and `prod-sqs` (`sqs`). By default a Sink is any node whose kind isn't `service`, so both data stores count; `endsAtSink.kinds=rds` gives the strict reading. On this data it changes 33 Routes to 30.
- **AND is the default.** The three task Filters each describe one part of a Route (where it starts, where it ends, what it passes), so a flat list of Filters means all must hold: a public entry reaching a Sink through a vulnerable node. This matches the attack-path models in the research notes. `or` / `not` trees cover anything else.
- **Limitation:** a Sink with outgoing edges can never end a Route, because Routes end at nodes with no outgoing edges. Both Sinks in this data have none.
- Unknown vulnerability severities become `unknown` with a warning. Duplicate edges are merged with a warning. Duplicate node names stop startup.

## Filters

The Filter Catalog (`GET /api/filters`) lists each Filter with its description, position and params as JSON Schema:

| Filter | Position | Params |
|---|---|---|
| `startsAtEntry` | start | none. Added automatically as the default view |
| `startsAtPublic` | start | none |
| `endsAtSink` | end | `kinds`: Sink kinds. Default: every kind in the graph except `service`. A kind not in the graph is a 400 |
| `hasVulnerability` | any | `minSeverity`: `low` / `medium` / `high` / `critical`, matching that level or above. Without it, any vulnerability matches, including `unknown`; with it, `unknown` never does |
| `passesThrough` | any | `node`: a node name. A node not in the graph is a 400 |
| `maxLength` | route | `hops`: integer ≥ 1, the most edges a Route may have |

Severity order: `unknown` < `low` < `medium` < `high` < `critical`.

## Querying the API

Open `/docs` for interactive Swagger documentation generated from the zod schemas. Endpoints: `GET /api/graph` (full graph and load warnings), `GET /api/filters`, `GET /api/routes`, `POST /api/routes/query` and `GET /health`.

```sh
# Required Filters: the three together (empty on this data), then two that match (30 Routes)
curl 'http://localhost:3000/api/routes?filters=startsAtPublic,endsAtSink,hasVulnerability'
curl 'http://localhost:3000/api/routes?filters=endsAtSink,hasVulnerability'

# Flat AND Query from public nodes, at most 2 hops
curl 'http://localhost:3000/api/routes?filters=startsAtPublic,maxLength&maxLength.hops=2&limit=10'

# Routes from Entries to rds through a high-severity vulnerability
curl 'http://localhost:3000/api/routes?filters=endsAtSink,hasVulnerability&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high'

# Tree Query: ends at a Sink AND (passes through order-service OR has no vulnerable node)
curl -X POST http://localhost:3000/api/routes/query -H 'content-type: application/json' -d '{
  "query": { "and": [
    { "filter": "endsAtSink" },
    { "or": [
      { "filter": "passesThrough", "params": { "node": "order-service" } },
      { "not": { "filter": "hasVulnerability" } }
    ] }
  ] },
  "limit": 50
}'
```

`GET /api/routes` runs a flat AND Query: `?filters=startsAtPublic,endsAtSink&endsAtSink.kinds=rds&limit=50`. Filter params are namespaced by Filter name; lists are comma-separated. Each Filter may appear once in GET. Use `POST /api/routes/query` for repeated Filters or nested `and` / `or` / `not` trees:

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

`limit` defaults to 100 and cannot exceed 1000. The engine looks for one extra matching Route to determine `meta.truncated`; `meta.routeCount` counts only returned Routes. All tree leaves are validated before searching, including branches that cannot match. Invalid Filter names, params, graph node names or Sink kinds return 400 RFC 7807 problem details. Filter errors name `filter`, `param` when applicable, and a `path` such as `query.and.0.or.1` locating the leaf in the submitted tree, before the Entry default is added. A flat GET Query returns the same response as POSTing its Filters as a top-level `and`. A POSTed bare start Filter (`{ "filter": "startsAtPublic" }`) is not a top-level `and` member, so it still gets `startsAtEntry`; wrap it in `and` to start wherever it matches.

## Exploring Routes

The default Query runs on first load. The left panel toggles Filters and their params; the canvas shows the full graph with matched nodes and edges highlighted and the rest dimmed. A legend explains node styles (Entries, Sinks, Inferred Nodes, public and severity badges). Pan, zoom, drag nodes or use the MiniMap.

- Click a node for its details and vulnerabilities; **Show Routes through here** runs the Query with a `passesThrough` Filter for it.
- Hover or click a Route in the list to highlight just that Route. The list works by keyboard (arrows, Enter, Escape).
- **Matched only** hides everything outside the matches and lays them out again.
- An empty result says why and shows how many Routes each active Filter matches on its own; click a hint to run just that Filter.
- **Advanced** builds an `and` / `or` / `not` tree with generated param inputs, validates every leaf before sending it to `POST /api/routes/query`, and shows the **Effective Query** the engine ran.

## Design decisions

- **Response shape `{ nodes, edges, routes, meta }`.** `nodes` (`{ id, data }`) and `edges` (`{ id, source, target }`) map straight onto React Flow or any graph renderer. The union subgraph alone loses which paths matched, so `routes` lists each Route as node ids. `meta` carries `routeCount`, `truncated`, `limit`, `effectiveQuery` and load `warnings`, so a client can tell a bounded result and the applied default apart from the data.
- **Filter Catalog plus typed implementations.** Metadata (name, description, position, zod params) lives in the domain package; each check lives in the API. The implementation map is typed against the catalog's names, so a missing half fails to compile. The API serves the catalog with params as JSON Schema, and the UI generates its Filter inputs from it, so a new Filter needs no engine, HTTP or UI changes. Position (`start` / `end` / `any` / `route`) follows the entry point → waypoint → target model in the research notes and tells the engine which node to check and what it can prune.
- **Pruning only from the top-level `and`.** Start candidates come from direct start-position leaves, a reverse BFS from matching end nodes skips branches that can't reach one, and `maxLength` bounds depth. Inside `or` / `not` a Filter doesn't constrain every matching Route, so using it would change results. Restricting to the top-level `and` keeps pruning sound and predictable, matches the default-view rule, and search order stays deterministic, so pruned and unpruned search return the same Routes.
- **Monorepo with a shared domain package.** pnpm workspaces, no task runner. The API and web app import one set of types, zod schemas and catalog metadata, so request validation in the UI and the API can't drift. The domain package has no dependency beyond zod; the Route engine and Filter checks exist only in the API, the single source of truth.
- **React Flow (`@xyflow/react`) with dagre.** Custom nodes are React components, so badges, Sink shapes, focus and accessible names are plain markup. Pan, zoom, drag and the MiniMap come built in. dagre gives a layered layout that follows call direction. See [`docs/research/graph-layout.md`](docs/research/graph-layout.md).
- **Atomic Design, enforced by lint.** `atoms → molecules → organisms → templates → pages`; a layer imports only layers before it. Atoms and molecules are presentational: no TanStack Query, Zustand, store, hook or API client imports. Both rules are ESLint errors (`import-x/no-restricted-paths` and `no-restricted-imports` in `eslint.config.js`), so the structure holds without review.
- **Errors** leave the API as RFC 7807 problem details naming the Filter, param and tree path; stack traces stay in server logs.
- **Theme:** light only, with self-hosted fonts (Outfit for headings, Inter for UI) and tokens in `apps/web/src/index.css`, after [`docs/research/backslash-design-system.md`](docs/research/backslash-design-system.md).

## State and rendering

| State | Home |
|---|---|
| Server data (graph, Filter Catalog, Routes) | TanStack Query |
| The Query (Filters, params, limit, view mode) | URL, parsed with domain schemas |
| Short-lived UI state (selected node, hovered and selected Route, dragged positions) | the single Zustand store |

The URL is the only copy of the current Query. It uses the `GET /api/routes` format plus `view=matched`, so a URL can be bookmarked, shared and navigated with Back/Forward:

```text
/?filters=endsAtSink,hasVulnerability&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high&limit=50&view=matched
```

An advanced tree is stored as base64url JSON in `q`. An invalid URL falls back to the default Query with a notice. The Query panel keeps only unsubmitted edits; **Run** validates them and writes the URL.

Layout (dagre) and React Flow conversion are pure modules in `apps/web/src/lib/`, cached per laid-out graph and direction, so Route hover never relays out the graph.

## Adding a Filter

Two files, and the compiler checks that both halves exist:

1. **Metadata** in `packages/domain/src/filters.ts`: add an entry to `filterCatalog` with a description, a position and a `z.strictObject` params schema.

   ```ts
   isJava: {
     description: 'Passes through a Java service.',
     position: 'any',
     params: z.strictObject({}),
   },
   ```

2. **Check** in `apps/api/src/filters/index.ts`: add the same key to `implementations`. Its params are typed from the schema; a `start` / `end` / `any` Filter returns a node check, a `route` Filter a Route check. Return `mismatches` for params that fit the schema but not the graph.

   ```ts
   isJava: () => ({ node: (node) => node.language === 'java' }),
   ```

Leaving out either half is a type error in `implementations`. Nothing else changes: the engine combines the check with `and` / `or` / `not` and prunes by its position, the HTTP layer parses its namespaced params, `/api/filters` and Swagger list it, and the UI panel and tree builder generate its inputs. A test (`apps/api/src/test/fixtureFilters.ts`) registers fixture Filters this way and runs them through the engine.

## Scaling

Every search is bounded by `limit`, and the engine stops after `limit + 1` Routes. Reachability pruning (reverse BFS from matching end nodes), start candidates from start Filters and the `maxLength` depth bound keep the DFS on nodes that can still match. This is enough for graphs of this size. Simple-path enumeration grows exponentially on dense graphs, so the next steps are precomputed indexes (reachability, per-node vulnerability and kind sets, cached per graph since it never changes at runtime), then a graph database (e.g. Neo4j) with path queries generated from the same Query tree.

## Testing

Tests go through three seams and assert on behavior visible there, not on internals:

1. **Engine** (`apps/api/src/engine/findRoutes.test.ts`, `apps/api/src/graph/loadGraph.test.ts`), built test-first: loading (string `to`, Inferred Nodes, unknown severities, invalid input, duplicates), every Filter and its params, `and` / `or` / `not`, the default `startsAtEntry`, cycles, `limit` / `truncated`, pruned versus unpruned search, a fixture where all three required Filters match, and the empty result on the real data.
2. **HTTP** (`apps/api/src/app.test.ts`) through Fastify `inject()`: query-string and body parsing, RFC 7807 errors, GET/POST equivalence, the Filter Catalog and health.
3. **UI page** (`apps/web/src/pages/ExplorerPage.test.tsx`): `ExplorerPage` with React Testing Library against an API mocked with MSW, covering Filter toggles, Route highlighting, node details, URL state, the empty state, warnings and keyboard use. The tree builder also has organism tests.

Plus Playwright tests (`pnpm e2e`) against the production build. Unit and component tests use vitest.

## Research

[`docs/research/attack-path-modeling.md`](docs/research/attack-path-modeling.md) backs the Filter model. Backslash's toxic code flows, Microsoft Defender's entry point → vulnerable node → critical target, and CodeQL's sources / sinks map onto `start` / `end` / `any` Filters, combined with AND by default.
