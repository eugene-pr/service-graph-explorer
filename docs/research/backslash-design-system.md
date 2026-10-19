# Backslash Security visual design system: notes for the Explorer UI

Researched 2026-10-19. Primary sources: live homepage HTML, its shared stylesheet, and computed styles read in a browser (Playwright). **[inferred]** marks judgments not stated by a source.

Sources:
- **HTML**: https://www.backslash.security/
- **CSS**: https://cdn.prod.website-files.com/6383ff6c86150510dc7adde2/css/backslash-security.shared.3994e4561.min.css (Webflow export; `:root` custom properties and class rules cited below as "CSS")
- **Computed**: computed styles on the live homepage, 2026-10-19 ("computed")
- **[unverified]** No public brand/press kit found (`/brand-kit` returns 404). No `theme-color` meta tag in the homepage HTML. No public app screenshots of the Backslash product graph UI were examined; imagery notes below are about the marketing site only. The logo SVG (https://cdn.prod.website-files.com/6383ff6c86150510dc7adde2/63b5790fd4aad837984d76a6_Backslash_logo.svg) has no literal `fill=` attributes, so its colors are not confirmed.

---

## 1. Color palette

Custom properties in CSS `:root`:

| Token (site) | Hex | Role |
|---|---|---|
| `--backslash-dark-blue` / `--dark` | `#09142f` | Ink: headings, body text on light, dark section bg (computed: h1/p color, dark section bg) |
| `--backslash-pink` | `#ed2690` | Brand accent; primary CTA bg (computed: "Book a Demo" button), hover/current nav link (CSS `.nav-link...:hover`) |
| `--dark-pink` | `#d52f91` | Pink variant (CSS) |
| `--like-pink` | `#fceef6` | Pink tint surface (CSS) |
| `--backslash-blue` | `#1a3edb` | Secondary brand blue (CSS) |
| `--royal-blue` | `#021df9` | Current nav link, gradient stops (CSS `.nav-link.w--current`, `linear-gradient(144deg,#28d7e2,var(--royal-blue)...)`) |
| `--backslash-teal` | `#63c1ca` | Teal accent (CSS) |
| `--black` / `--black-2` | `#0a1216` / `#191919` | Heading black (CSS `.heading-medium`) |
| `--gray-text` | `#5b5773` | Muted text (CSS) |
| `--dim-grey` | `#666` | Body text default (computed: `body` color `rgb(102,102,102)`) |
| `--light-slate-grey` / `--ui-grey-2` | `#8f96b0` / `#9ca0b3` | Tertiary text (CSS) |
| `--cool-gray` / `--light-cool-gray` | `#cdd5de` / `#ebeef2` | Borders, light surfaces (CSS) |
| `--line` | `#9ba9b44f` | Hairline border, alpha ~31% (CSS) |
| `--white-smoke`, `--grey` | `#f3f3f3`, `#e5e5e5` | Neutral surfaces (CSS) |
| `--error-color` | `#ec0202` | Error red (CSS) |
| `--iconcard-color` | `#ce4a4a` | Muted red used on icon cards (CSS) |

Other frequent literals in CSS (counts from the stylesheet): `#642eff` (violet; `.button-primary` bg, a legacy button), `#d7dcff` (periwinkle tint used in light gradients), `#160042` and `#01036c` (deep indigo/navy), `#28d7e2` (cyan gradient start), `#27313d` (cookie button bg, computed).

Page backgrounds, computed from section backgrounds on the homepage: white `#ffffff`, pale lavender tints `#f0f3ff`, `#fcfcff`, `#f2f4ff`, and dark navy `#09142f`. So the site alternates light lavender-white sections with full-bleed dark navy sections.

Severity: **no severity palette in the site CSS** (only `--error-color #ec0202`). Severity colors below are **[inferred]**.

## 2. Typography

- **Headings**: Outfit, fallback Arial/sans-serif; weights 700 and 900 loaded (CSS `@font-face`, self-hosted woff2). Computed: h1 56px/700/line-height 60.5px/letter-spacing -0.84px; h2 44px/700/-0.44px; h3 40px/700/line-height 44px. Other CSS rules: `.heading-xlarge` 4rem, `.heading-medium` 2rem, `.heading-small` 1.25rem, all 700.
- **Body/UI**: Inter, fallback Arial; weights 200-900 loaded (CSS `@font-face`). Computed: body 16px/400; paragraph 20.8px/line-height 32.2px; nav link 16px/500 (CSS `.nav-link.first.nav`).
- Headings are tight-tracked (negative letter-spacing) and bold; body is regular Inter at a generous line-height. A `Graphik Medium` face appears in 3 rules (CSS) but no `@font-face` is declared; ignore.

## 3. Spacing, radii, shadows

- **Radii** (most frequent in CSS): `10px` (37), `.5rem` (27), `4px` (23, buttons), `50px` pill (legacy `.button-primary`), `50%`/`100%` circles. Computed: v3 button 4px; cookie button 10px.
- **Shadows**: the signature is a hard offset "neo-brutalist" shadow with no blur, `4px 4px 0 0 var(--dark)` on buttons (CSS `.v3_button`), `4px 4px 0 0 var(--white)` on dark sections, `4px 4px 0 0 var(--backslash-pink)` on some cards. Soft shadows are rare: `5px 5px 20px #00000026`, `1px 1px 8px -5px #333`.
- **Spacing**: rem-based. Button padding `.875rem 2rem` (or `.75rem 1.5rem`); nav height `5rem`; heading blocks `margin 8rem` on a few templates. No spacing scale tokens. Section rhythm is generous **[inferred]**.
- **Nav**: fixed, `backdrop-filter: blur(8px)`, bg `#ffffffcc` (CSS `.navbar`, `.navi`).

## 4. Component patterns

- **Primary button** (CSS `.v3_button`, computed): pink `#ed2690` bg, white text, 700 weight, `1px solid #000` border, 4px radius, hard shadow `4px 4px 0 0 #09142f`; transition on `box-shadow` and `transform` at .1s (press-in effect **[inferred]** from the transition). Padding `.875rem 2rem`.
- **Secondary button** (computed "Get Free Assessment"): white bg, `#09142f` text, same black border and hard shadow. Ghost variant: transparent bg, dark text (CSS variant `295f635b...`). On dark sections: white border and white hard shadow (CSS variants `fd40bb6c...`, `1dd32d0e...`).
- **Legacy button** (CSS `.button-primary`): violet `#642eff`, pill radius 50px, 48px min-height, 14px/500. Older style; avoid.
- **Nav links**: Inter 16px/500; hover pink `#ed2690`, current page `#021df9` (CSS).
- **Cards**: 10px or .5rem radius, light lavender or white surfaces, 1px cool-gray borders **[inferred from radii/border tokens]**; some with hard offset shadows (CSS).
- **Badges/chips**: no dedicated badge class was verified. **[unverified]**

## 5. Imagery, graph, illustration

- Hero and sections use gradients: `linear-gradient(144deg, #28d7e2, #021df9 ...)` (cyan to royal blue), `linear-gradient(342deg,#fff 40%,#d7dcff)` and `linear-gradient(#d7dcff,#fff 60%)` (periwinkle fade on light sections), `linear-gradient(180deg, #ed2690 ...)` (pink) (CSS).
- Third-party tool logos are shown as 14px icons (homepage `<img>` for Claude Code, Cursor).
- Graph or product UI screenshots were not examined. **[unverified]** From the written concepts (see `attack-path-modeling.md`), their App Graph is a flow of microservices; no visual spec found.

## 6. Tone

Security-vendor confident, plain and imperative: CTAs "Book a Demo", "Get Free Assessment", "Read the full case study" (computed button text). Heading from page title: "Secure AI Agents with Agentic AI Security" (HTML `<title>`). Short, bold headline plus airy supporting copy **[inferred]**.

---

## Mapping to this project

Terms follow `CONTEXT.md` (Route, Entry, Sink, Inferred Node, Filter). Everything here is a **proposal [inferred]** built on the site tokens above. Severity hues are not Backslash-sourced.

Principle: dark-navy ink + pink accent + lavender-white surfaces; Outfit for headings, Inter for UI; hard offset shadow reserved for primary buttons and the selected node; hairline borders elsewhere.

```css
:root {
  /* brand (sourced) */
  --color-ink: #09142f;          /* --dark; text, dark panels */
  --color-accent: #ed2690;       /* --backslash-pink; primary action, selected Route */
  --color-accent-soft: #fceef6;  /* --like-pink; hover/selected bg */
  --color-blue: #1a3edb;         /* --backslash-blue; links, focus ring */
  --color-teal: #63c1ca;         /* --backslash-teal */

  /* surfaces + text (sourced neutrals) */
  --color-bg: #ffffff;
  --color-surface: #f2f4ff;      /* homepage lavender section bg */
  --color-surface-2: #f0f3ff;
  --color-border: #cdd5de;       /* --cool-gray */
  --color-border-subtle: #9ba9b44f; /* --line */
  --color-text: #09142f;
  --color-text-muted: #5b5773;   /* --gray-text */
  --color-text-faint: #8f96b0;   /* --light-slate-grey */

  /* fonts */
  --font-display: Outfit, Arial, sans-serif;  /* 700 */
  --font-sans: Inter, Arial, sans-serif;      /* 400/500/600 */

  /* radii, shadow */
  --radius-sm: 4px;   /* buttons, badges, nodes */
  --radius-md: 10px;  /* cards, panels */
  --shadow-hard: 4px 4px 0 0 var(--color-ink);
  --shadow-hard-accent: 4px 4px 0 0 var(--color-accent);
  --shadow-soft: 5px 5px 20px #00000026;
}
```

### Graph nodes (proposed)

| Concept | Treatment | Tokens |
|---|---|---|
| Service (plain) | white fill, 1px `--color-border`, ink text | `--node-service-bg: #fff`, `--node-service-border: #cdd5de` |
| **Entry** | ink-navy fill, white text, entry glyph; reads as "start" | `--node-entry-bg: #09142f`, `--node-entry-fg: #fff` |
| **Sink** (rds, sqs) | distinct shape (cylinder/rounded-pill) per `NodeShape`; lavender fill, ink border | `--node-sink-bg: #f2f4ff`, `--node-sink-border: #1a3edb` |
| **Inferred Node** | dashed border, faint text, white fill; dashed because "assumed, not in data" | `--node-inferred-border: #8f96b0` (dashed), `--node-inferred-fg: #5b5773` |
| **Public badge** | pink pill: `bg #ed2690`, white text, 4px radius (pink = exposure/attention, matches brand accent) | `--badge-public-bg`, `--badge-public-fg` |
| Selected node/Route | pink 2px outline + `--shadow-hard-accent`; Route edges pink `#ed2690`, others `#9ca0b3` | `--edge-default`, `--edge-route` |

### Severity (proposed; not from Backslash)

Keep Backslash pink for "public", so severity needs separate hues to avoid collision. Use tinted bg + strong text pairs (check AA contrast when implemented).

| Severity | Text | Bg tint |
|---|---|---|
| critical | `#ec0202` (site `--error-color`) | `#fde8e8` |
| high | `#ce4a4a` (site `--iconcard-color`) | `#fbeaea` |
| medium | `#b45309` | `#fef3c7` |
| low | `#1a3edb` | `#e4e6f1` |

Tailwind-ish names: `colors.ink`, `colors.accent`, `colors.surface`, `colors.border`, `colors.node.{service,entry,sink,inferred}`, `colors.severity.{critical,high,medium,low}.{fg,bg}`, `fontFamily.display|sans`, `borderRadius.sm|md`, `boxShadow.hard|hard-accent`.

### Notes
- Page chrome: light lavender canvas (`--color-surface`) with white panels; dark `--color-ink` for the top bar and Legend, mirroring the site's light/dark section alternation.
- Primary buttons (run Query, apply Filter): site `.v3_button` look (pink, black 1px border, hard shadow). Secondary: white with ink text. Drop pill shapes.
- Font loading: the site self-hosts Outfit 700/900 and Inter 400-700 woff2 files; for us use `@fontsource/outfit` and `@fontsource/inter` **[inferred]**. Mind licensing of the site's files; both are OFL on Google Fonts **[unverified here]**.
