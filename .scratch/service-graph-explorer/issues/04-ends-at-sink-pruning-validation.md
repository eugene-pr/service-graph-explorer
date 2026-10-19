# 04: `endsAtSink`, pruning and validation against the graph

**What to build:** a reviewer can filter Routes that end at a Sink and choose which node kinds count as Sinks. The engine skips branches that can't reach a matching end node, and the results are exactly the same as without pruning. Params that refer to things not in the graph return a clear 400.

Spec: Domain language (Sink), Modules → Route engine (pruning) / Validation against the graph, Filter Catalog.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] `endsAtSink` with the `kinds: string[]` param; the default is every kind except `service` present in the graph
- [x] Decide where node facts live (architecture review, 2026-10-19). The web app currently has its own copy of the Sink rule (`isSink`: kind ≠ `service`) and the highest-severity rule in `apps/web/src/lib/graph.ts`, while the API's Filters need the same rules. Option: the API's Graph module works out Sink (default kinds), Entry and highest severity once and sends them in each node's `data`, and the UI only renders them. Open question: a Query's `kinds` override changes which nodes are Sinks, and these served facts cover only the default. Whatever you choose, there must be one home for the Sink rule.
- [x] Graph validation step: each `kinds` value must be a kind present in the graph, otherwise a 400 in RFC 7807 format naming the Filter and param
- [x] When the top-level `and` has end-position Filters as direct members, precompute the nodes that can reach a matching end node (reverse BFS) and skip branches outside that set
- [x] Pruning reads only direct members of the top-level `and`, so 11 can add `or`/`not` without changing the pruning code (11 tests this)
- [x] UI: `endsAtSink` toggle with a kinds multi-select listing the kinds in the graph
- [x] Tests (seam 1):
  - `endsAtSink` with the default kinds and with a custom subset
  - pruned and unpruned search return the same Routes, including with a limit
  - a pruning test with a deliberate dead-end branch
- [x] Tests (seam 2): an unknown sink kind returns 400
- [x] Tests (seam 1): on the real data, `startsAtPublic` + `endsAtSink` returns an empty result
- [x] README reflects this ticket's behavior (only if 15 already landed; otherwise 15 covers it)
