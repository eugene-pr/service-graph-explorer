# 10: Empty state with per-Filter counts

**What to build:** when a Query matches nothing, the reviewer sees an explanation and, for each active Filter, how many Routes it matches on its own. They can see which Filter to drop. The copy is generic, so it stays correct for any graph file.

Spec: UI (empty state).

**Blocked by:** 03

**Status:** ready-for-agent

- [x] An empty result shows a generic message and "try removing a Filter" hints
- [x] Each hint shows that Filter's Route count on its own, using the same Query endpoint, fired in parallel through TanStack Query
- [x] Clicking a hint removes the other Filters (or applies just that one)
- [x] The UI copy contains no facts specific to this data
- [x] Tests (seam 3): an empty result shows hints with the per-Filter counts from the MSW mocks
- [x] README reflects this ticket's behavior
