# 07: `maxLength`

**What to build:** a reviewer can cap Route length in hops, to focus on short attack paths. This shows a Filter that checks the whole Route rather than one node position.

Spec: Filter Catalog (`maxLength`), Modules → Route engine (depth bound).

**Blocked by:** 03

**Status:** ready-for-agent

- [x] `maxLength` with a `hops` param (integer ≥ 1) matches Routes with at most that many edges; position is `route`
- [x] When `maxLength` is a direct member of the top-level `and`, it also limits search depth
- [x] UI: `maxLength` toggle with a number input
- [x] Tests (seam 1): boundary cases (exactly `hops`, `hops + 1`), and the depth limit returning the same Routes as no limit (`maxLength` inside `or` is tested in 11)
- [x] Tests (seam 2): `hops: 0` or a non-integer returns 400
- [x] README reflects this ticket's behavior
