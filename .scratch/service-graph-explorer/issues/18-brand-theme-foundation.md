# 18: Brand theme foundation

**What to build:** the Explorer page loads with the Backslash look: brand colors, fonts and page chrome. Design tokens are the single source for color, font and shadow. Research: `docs/research/backslash-design-system.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Tailwind `@theme` block in the web app's `index.css` defines: ink, accent, accent-soft, blue, surface, border, text-muted, text-faint
- [x] Tokens for Entry, Sink and Inferred Node
- [x] Severity fg/bg pairs: critical `#ec0202`, high `#c2410c`, medium `#b45309`, low `#1a3edb`, each with a tinted bg; AA contrast checked per pair
- [x] Hard-shadow tokens (`hard`, `hard-accent`) defined, not yet used
- [x] Outfit (700) and Inter (400/500/600) self-hosted via `@fontsource`; display font for headings, Inter for UI
- [x] Header is navy with white text and the title in Outfit; canvas is lavender; panels are white
- [x] No teal, soft shadow or dark mode
- [x] `CLAUDE.md` notes: design tokens live in the web app's `@theme`; no hardcoded colors
- [x] `pnpm verify` green
