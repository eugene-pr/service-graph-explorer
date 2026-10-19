Backslash take-home: REST API + React UI for querying Routes in a microservice graph. Assignment: `TASK.md`.

## Where truth lives

- Domain terms (Route, Entry, Sink, Inferred Node, Filter, Filter Catalog, Query): `CONTEXT.md`. Use these words in code, API and UI copy.
- What to build and why: `.scratch/service-graph-explorer/spec.md`; work items: `.scratch/service-graph-explorer/issues/`.

## Architecture rules

- pnpm workspaces only.
- Domain package holds types, zod schemas and Filter Catalog metadata, and nothing else. Both apps import it.
- The Route engine and Filter implementations live in the API. The implementation map is typed against the Filter Catalog's names, so a missing half fails to compile.
- UI state has one home per kind:

  | State | Home |
  |---|---|
  | Server data (graph, Filter Catalog, Routes) | TanStack Query |
  | The Query (Filters, params, limit, view mode) | URL, parsed with domain schemas |
  | Short-lived UI state (selection, hover, panels) | the single Zustand store |

- Atomic Design: atoms → molecules → organisms → templates → pages. A layer imports only layers before it in this list. Atoms and molecules are presentational: props in, markup out, with no store, hook or API client imports. Both rules are lint errors.
- Define design colors, fonts and shadows in the `@theme` block in `apps/web/src/index.css`; use those tokens in components instead of hardcoded colors. Load shared fonts through that stylesheet so the app and Storybook use the same typography.

## TypeScript practices

- **YAGNI:** build what the current ticket's acceptance criteria require; keep the diff to that ticket.
- Every external boundary parses through a zod schema from the domain package: HTTP requests, `GRAPH_FILE`, URL params.
- The engine is pure TypeScript with no Fastify imports; handlers parse, call the engine, and shape the response.
- Every Route search is bounded by `limit`.
- Errors leave the API as RFC 7807 problem details; stack traces stay in server logs.

## Testing

- The engine is built test-first.
- Tests go through the three seams in the spec: the engine interface, the HTTP interface (`inject`), and the UI page (MSW). Assert on behavior visible at the seam.
- Work is done when `pnpm verify` (typecheck, lint, test, build) is **green**.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
