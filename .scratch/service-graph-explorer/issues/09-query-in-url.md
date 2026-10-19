# 09: Query in the URL

**What to build:** the current flat Query (Filters, params, limit, view mode) lives in the URL, so views can be bookmarked and shared. The default Query runs on first load. A broken or stale URL falls back to defaults instead of crashing.

Spec: UI (state ownership, first load).

**Blocked by:** 03

**Status:** ready-for-agent

- [x] The Query hook from 03 is switched from local state to URL search params, validated with the shared domain schemas. Its interface doesn't change, and no caller changes.
- [x] The URL format matches the API's query string: `filters=…`, `<filter>.<param>=…`, `limit`, plus the view mode
- [x] Invalid or unknown values fall back to defaults, with a short non-blocking notice
- [x] On first load the default Query (Routes from Entries) runs, so the Route list starts populated
- [x] Back and forward browser navigation move between Queries
- [x] The Query is not duplicated in the Zustand store or in component state
- [x] Tests (seam 3): opening a URL with Filters runs that Query, changing a Filter updates the URL, an invalid URL falls back to defaults, and the default Query runs on first load
- [x] README reflects this ticket's behavior
