# 01: Walking skeleton

**What to build:** a pnpm-workspace monorepo with an API app, a web app and a shared domain package, wired end to end. A developer runs one install and one dev command, and both apps start. The web app shows the API's health status fetched through the dev proxy, which proves every layer connects. Linting enforces the Atomic Design import direction from day one.

Spec: `.scratch/service-graph-explorer/spec.md` (Monorepo and delivery; UI → Atomic Design).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] pnpm workspaces via corepack: an API app (Fastify), a web app (React + Vite + Tailwind) and a domain package (zod only), on Node 22 + ESM
- [x] The domain package is consumed as TypeScript source by both apps, with no build step in dev
- [x] Root scripts: `dev` (both apps in parallel), `build`, `test`, `lint`, `typecheck`, and `verify` (typecheck + lint + test + build), all passing
- [x] TypeScript strict mode everywhere
- [x] Typed ESLint rules enabled as errors: `no-explicit-any`, `ban-ts-comment`, `no-floating-promises`, `no-misused-promises`, and a rule against unsafe type assertions
- [x] `GET /health` returns OK
- [x] The Vite dev proxy forwards `/api` and `/health` to the API; the web app shows the API's status
- [x] Web folders scaffolded: atoms, molecules, organisms, templates, pages, hooks, api, store, lib
- [x] An ESLint import-boundary rule blocks lower Atomic Design layers from importing higher ones, and a deliberate violation fails lint (verified, then removed)
- [x] A `no-restricted-imports` rule blocks atoms and molecules from importing the store, hooks or the API client, and a deliberate violation fails lint (verified, then removed)
- [x] vitest is configured in all three packages, each with one passing test
- [x] `.gitignore` covers build output and dependencies
