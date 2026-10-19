# 16: E2E smoke test (optional)

**What to build:** one or two Playwright tests prove the real stack works: the page loads, a Filter is turned on, and matching Routes are highlighted. Cut first if time runs short.

Spec: Testing Decisions (optional E2E).

**Blocked by:** 04, 08

**Status:** ready-for-agent

- [x] Playwright runs against the real API + web app (dev or the production build)
- [x] Smoke test: load the page → the graph renders → turn on `endsAtSink` → Routes are listed → hovering a Route highlights its nodes
- [x] Runs with one script; added to CI only if it's fast and stable
- [x] README reflects this ticket's behavior
