# 19: Apply tokens to graph and badges

**What to build:** the graph and its supporting UI use the brand tokens: Entry, Sink and Inferred Node look distinct, the public badge is pink, severity badges use the new scale. Research: `docs/research/backslash-design-system.md`.

**Blocked by:** 18

**Status:** ready-for-agent

- [x] Entry nodes render navy with white text; Sink nodes keep their distinct shape with lavender fill and blue border; Inferred Nodes have a dashed border and muted text
- [x] Public badge renders as a pink pill with white text
- [x] Severity badges use the token severity pairs
- [x] Legend, warnings banner and edges restyled with tokens; Legend reflects the new node treatments
- [x] No stock slate/indigo/amber classes or hardcoded hex colors remain in the web app source
- [x] Existing `ExplorerPage` tests stay green; behavior at the seam unchanged
- [x] `pnpm verify` green
