# 14: Docker production build

**What to build:** a reviewer with only Docker runs `docker compose up` and gets the API, the Swagger docs and the UI on one port.

Spec: Monorepo and delivery; HTTP layer (static serving).

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Multi-stage Dockerfile: install, build the web app and the API, then a slim runtime image
- [x] In production, Fastify serves the built web app at `/`, with a fallback to the SPA, alongside `/api`, `/docs` and `/health`
- [x] The Compose file uses one service and one port, with a healthcheck on `/health`
- [x] `GRAPH_FILE` can be overridden through Compose, e.g. by mounting a volume
- [x] Choosing the graph file sits behind one function, e.g. `loadGraphFromEnv(env)`, instead of being split between `server.ts` (`GRAPH_FILE ?? DEFAULT_GRAPH_FILE`) and the loader. The bundled-file default (`DEFAULT_GRAPH_FILE`, currently resolved relative to `src/`/`dist/`) must also work in the image. A test covers both `GRAPH_FILE` set and unset (architecture review, 2026-10-19).
- [x] Verified: `docker compose up` serves the UI and the API works from the browser
- [x] README reflects this ticket's behavior (only if 15 already landed; otherwise 15 covers it)
