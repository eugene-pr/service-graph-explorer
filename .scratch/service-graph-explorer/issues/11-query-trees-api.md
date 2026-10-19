# 11: Query trees via the API

**What to build:** an API consumer can send a nested `and`/`or`/`not` Query as a JSON body and get the same result shape as the flat endpoint. The response shows which Query actually ran. This can be tried through Swagger.

Spec: Domain language (Query, default view), Modules → Route engine (pruning only from the top-level `and`), API contract (`POST /api/routes/query`).

**Blocked by:** 04

**Status:** ready-for-agent

- [x] The domain package defines a recursive Query schema: leaf `{ filter, params? }`, `{ and: [...] }`, `{ or: [...] }`, `{ not: ... }`
- [x] The engine evaluates `and`/`or`/`not` by combining Filter checks
- [x] `POST /api/routes/query` takes `{ query, limit? }` and returns the same result shape as `GET /api/routes`, including `meta.effectiveQuery`
- [x] Every Filter in the tree is validated against its params schema and against the graph, and errors point to the Filter's position in the tree
- [x] Pruning and start candidates come only from direct members of the top-level `and`
- [x] Repeated Filters work (e.g. passing through A *and* B)
- [x] Tests (seam 1):
  - `or`, `not`, nested trees
  - `startsAtEntry` added for `or`/`not` roots, and start Filters nested inside `or`/`not` don't prevent it
  - end Filters inside `or`/`not` never drive pruning, and pruned equals unpruned for such Queries
  - `maxLength` inside `or` doesn't limit search depth
- [x] README reflects this ticket's behavior
- [x] Tests (seam 2): `GET` and `POST` return the same result for equivalent flat Queries; tree validation errors in RFC 7807 format; the endpoint appears in `/docs`
