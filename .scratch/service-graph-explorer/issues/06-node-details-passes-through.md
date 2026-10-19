# 06: Node details and `passesThrough`

**What to build:** a reviewer clicks a node to see its details (kind, language, path, public flag, vulnerabilities with file, severity, message and CWE, inferred flag). A "Show Routes through here" button adds a `passesThrough` Filter for that node and runs the Query.

Spec: Filter Catalog (`passesThrough`), Modules → Validation against the graph, UI (layout bottom panel, state ownership).

**Blocked by:** 04

**Status:** ready-for-agent

- [x] `passesThrough` with a `node` param matches Routes that include that node
- [x] Graph validation: an unknown `node` returns 400 in RFC 7807 format
- [x] The selected node is kept in the single Zustand UI store (short-lived UI state only, never server data or the Query). If the store doesn't exist yet (08 not landed), create it; if it does, extend it. There must never be two stores.
- [x] Clicking a node selects it, and a details panel at the bottom shows all its data
- [x] "Show Routes through here" adds `passesThrough` for that node to the current Query and runs it
- [x] The details panel can be used with the keyboard and has accessible names
- [x] Tests (seam 1): `passesThrough` matching
- [x] Tests (seam 2): an unknown node returns 400
- [x] Tests (seam 3): selecting a node shows its details, and "Show Routes through here" sends the right Query
- [x] README reflects this ticket's behavior
