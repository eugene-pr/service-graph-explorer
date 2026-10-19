# 12: Advanced tree builder UI

**What to build:** a power user turns on "Advanced" in the Query panel and builds an `and`/`or`/`not` tree visually. It runs against the tree endpoint, shows the Query that actually ran (including the added `startsAtEntry`), and the tree is kept in the URL for sharing.

Spec: UI (advanced mode, state ownership `q` param).

**Blocked by:** 09, 11

**Status:** ready-for-agent

- [x] An "Advanced" toggle switches the Query panel between the flat Filter list and the tree builder
- [x] The tree builder can add, remove and nest `and`/`or`/`not` groups and Filter leaves; leaf param inputs are generated from the Filter Catalog
- [x] It runs through `POST /api/routes/query`
- [x] The effective Query (with the added `startsAtEntry`) is shown read-only
- [x] The tree is kept in the URL as JSON in URL-safe base64 in the `q` param; an invalid `q` falls back to defaults
- [x] Switching from flat to advanced turns the current flat Query into an `and` tree
- [x] The tree builder works with the keyboard and has accessible names
- [x] Tests (organism level, since the page level can't reach it): build a nested tree and check the request body; `q` round-trips through the URL
- [x] README reflects this ticket's behavior
