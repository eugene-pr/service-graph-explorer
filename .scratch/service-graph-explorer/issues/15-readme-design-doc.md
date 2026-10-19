# 15: README design doc

**What to build:** the README, which is the written deliverable. A reviewer understands the solution, the assumptions and the reasoning in a few minutes, and can run it with one command. It's written early, as soon as the minimum version works, and covers the full design from the spec, with features not yet built marked "planned". Later tickets keep it current.

Spec: whole spec, especially Further Notes (data findings), Out of Scope and the decision rationale; research notes in the docs folder; `CONTEXT.md` glossary.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Overview and run instructions: `corepack enable && pnpm i && pnpm dev`, `docker compose up`, the URLs (UI, `/docs`), `GRAPH_FILE`
- [x] Data findings:
  - the three required Filters combined return nothing on the provided data, and why
  - `assurance-service` is missing from `nodes` (Inferred Node)
  - one edge has a string `to`
  - one vulnerability's message and CWE disagree
  - every service is Java
  - there are no cycles
- [x] Assumptions:
  - Route definition and the default view
  - "rds/sql" read as `rds` + `sqs`
  - AND is the default
  - Sinks are assumed to have no outgoing edges (limitation)
- [x] Each decision with its reasoning:
  - response shape
  - Filter Catalog + typed implementations
  - pruning only from the top-level `and`
  - monorepo + shared domain package
  - React Flow
  - Atomic Design + the lint rule
- [x] State ownership table (TanStack Query / URL / Zustand)
- [x] "Adding a Filter": two files, enforced by the compiler, with a short walkthrough
- [x] API overview with a pointer to `/docs`, and example curl calls including a tree Query
- [x] Scaling path: reachability pruning now; precomputed indexes or a graph DB later
- [x] Testing approach: the three test seams
- [x] A short reference to the attack-path research notes
- [x] The CI badge (once 13 has landed)
- [x] Features not built yet are clearly marked "planned", so the README is accurate at every point
