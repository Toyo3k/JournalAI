# Design Memory

## Brand Tone

- **Adjectives:** premium, futuristic, playful. Visual references: Linear (precision, crisp type, subtle surfaces) and Stripe (beautiful data visualisation, gradients).
- **Identity comes from the logo:** electric blue and white chrome on near-black, cyan glow, and a connected neural-nodes motif. Reuse the node motif (hero backdrop, insight "constellation", node dots) rather than inventing new decoration.
- **Avoid:**
  - Generic dark-dashboard sameness, where every surface is an identical bordered card.
  - Periwinkle `#8592ff`, the old accent, which clashes with the logo.
  - Glow on everything: keep it for the score, the primary action and the equity line.
- **Copy:** never use em dashes. Use periods, commas or parentheses.

## Layout & Spacing

- **Density:** comfortable. Compact terminal layouts were explored and rejected for the main report.
- **Page rhythm:** a full-bleed hero, then centred sections (max-width about 1120px) with generous gaps (about 64px between sections).
- **Surfaces:** "glass" panels, a subtle vertical gradient from `--nx-surface-2` to `--nx-bg-raised` at about 75% opacity, with a 1px `--nx-line-strong` border and an inner top highlight.
- **Corner radius:** 20px for panels and signal cards, 14px for small tiles, pills (999px) for primary actions.
- **Shadows:** mostly none. Blue glow (`0 0 30px -6px rgb(31 139 255 / 0.8)`) only on primary actions and the hovered signal card.
- **Grid:** hero is 1.2fr and 1fr (copy, score) and stacks under 860px. Signals and paired charts use 3-up and 2-up grids that stack on mobile.

## Typography

- **Display:** Unbounded (`--nx-display`) for big numerals, the score and section titles.
- **Section titles:** Unbounded 13px, weight 600, letter-spacing 0.4em, uppercase, muted colour (echoes the wide-tracked wordmark).
- **Body:** Inter. **Numbers and addresses:** tabular figures, and JetBrains Mono for addresses.
- **Net P&L headline:** Unbounded 600, `clamp(40px, 6vw, 64px)`, letter-spacing -0.03em, line-height 1. The gradient runs `#ffffff` into `#8ff3c9` for gains and into `#ffb0b8` for losses, clipped to the text.

## Color

- **Primary:** `--nx-blue #1f8bff`, `--nx-blue-bright #4aa8ff`, `--nx-cyan #5fd8ff`, and the `--nx-electric` gradient (blue into cyan) for primary buttons and the score ring.
- **Neutral strategy:** blue-tinted near-blacks (`#05070b` to `#182133`), with lines drawn in translucent blue rather than grey.
- **Semantic:** gain `#2fe0a4`, loss `#ff6b7a`, caution `#ffc05c`, each with a 12% "soft" background variant.
- **Charts:** a diverging green and red intensity scale for P&L cells, empty days in `--nx-surface-2`, and cyan for the equity line.

## Interaction Patterns

- **Charts are explorable:** every data point shows its values on hover, tap and keyboard (arrow keys, Home, End). The crosshair snaps to the nearest real data point.
- **Tooltips:** dark glass with a cyan hairline border. Values are coloured by sign and always carry a `+` or `-`. Tooltips flip near edges and sit below the point when it is near the top.
- **Linked views:** the equity curve and drawdown band share one crosshair.
- **Progressive disclosure:** a verdict and the top three insights first, detail below.
- **Motion:** 120 to 600ms ease-out entrances (hero rise, tooltip fade), a slow node pulse, and hover lift on signal cards. All of it respects `prefers-reduced-motion`.
- **Feedback:** inline status text (for example "Link copied"). No toasts.

## Accessibility Rules

- **Focus:** 2px cyan outline with offset on everything focusable, including the chart explorer.
- **Charts:** the SVG gets `role="img"` or a labelled group, plus an `aria-live` announcement of the active point. Decorative layers (node field, glows) are `aria-hidden`.
- **Colour is never the only signal:** use signs, labels and tags ("Strength", "Leak").
- **Touch targets:** at least 44px.
- **Motion:** reduced-motion collapses animations to near zero.

## Repo Conventions

- **Styling:** CSS Modules plus CSS custom properties. No Tailwind or UI library. Charts are hand-built SVG, with no charting dependency.
- **Components:** server components by default. Only interactive pieces (chart explorer, tooltip layer, tabs) are client components that receive plain serialisable props.
- **Data consistency:** every visual total must reconcile with the headline net P&L (fees included). Derivations belong in `src/lib/analytics`, not in components.
- **Temporary routes:** folders starting with `_` are private and unroutable in this Next version. Use a plain folder name for temporary pages.

---

_Updated by Design Lab_
