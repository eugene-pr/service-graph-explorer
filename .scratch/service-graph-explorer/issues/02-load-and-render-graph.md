# 02: Load and render the full graph

**What to build:** the API loads the graph file at startup, normalizes and validates it, and serves it. The UI shows the whole graph laid out top-down, with node visuals a reviewer can read at a glance and a banner showing data warnings.

Spec: Domain language, Modules → Graph loader, API contract (`GET /api/graph`), UI (canvas, node visuals, accessibility).

**Blocked by:** 01

**Status:** ready-for-agent

- [x] The domain package defines schemas for the raw input file and for the normalized graph: node, edge, vulnerability, severity (`unknown` < `low` < `medium` < `high` < `critical`)
- [x] The loader accepts `to` as a single string or an array
- [x] Edge targets missing from `nodes` become Inferred Nodes (kind `service`, `inferred: true`), each with a warning
- [x] Duplicate node names make startup fail with a clear error
- [x] Duplicate edges are merged, with a warning
- [x] Unknown severities map to `unknown`, with a warning
- [x] Structurally invalid input fails startup with readable zod errors
- [x] The graph comes from the bundled data file by default, or from the file in the `GRAPH_FILE` env var
- [x] `GET /api/graph` returns `{ nodes: {id, data}[], edges: {id, source, target}[], meta: { warnings } }`
- [x] The canvas renders the graph with React Flow and a top-down dagre layout, with pan and zoom
- [x] Node visuals:
  - public badge
  - vulnerability badge colored by the highest severity
  - distinct shape for Sinks
  - dashed border for Inferred Nodes
  - every badge has a text label, not color alone
- [x] A legend explains the badges and shapes
- [x] A warnings banner shows the load warnings
- [x] Loading and error states are shown
- [x] Seam-3 test tooling set up for the web app, so later tickets reuse it: React Testing Library, MSW handlers for the API, and jsdom stand-ins that React Flow needs (ResizeObserver, DOMMatrix, element sizes)
- [x] Tests (seam 1): `to` normalization, Inferred Node + warning, duplicate names failing, duplicate edges merged, unknown severity, invalid input failing, and the real data loading with exactly one Inferred Node (`assurance-service`)
- [x] Tests (seam 2): `GET /api/graph` shape
- [x] Tests (seam 3): the page renders the nodes and shows the warnings banner (with MSW)
