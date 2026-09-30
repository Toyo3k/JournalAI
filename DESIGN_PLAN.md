# Design Implementation Plan: Wallet Report

## Summary

- **Scope:** page redesign
- **Target:** `src/components/report/report-view.tsx`, rendered by `src/app/wallet/[address]/page.tsx` and `src/app/demo/page.tsx`
- **Winner:** Variant E ("Neural", the expressive direction), with two changes from feedback:
  1. Every data point on the equity chart is hoverable and shows its values, and the heatmaps get the same treatment.
  2. The net P&L number uses Variant A's treatment: display font, tight tracking, white into mint gradient (coral when negative).
- **Key improvements over today:**
  - The palette comes from the NeuroX logo (electric blue, cyan glow, white chrome) instead of periwinkle `#8592ff`.
  - The logo's connected-nodes motif appears in the hero, the score and the insights.
  - The hero leads with a verdict: P&L, a one-sentence summary and a NeuroX score with three sub-scores.
  - The top insights move above the fold, drawn as a connected "constellation".
  - New charts: an interactive equity and drawdown explorer, a daily P&L calendar and an hour-by-weekday heatmap.
  - Section titles use wide-tracked display type that echoes the wordmark.

The appendix contains the full, verified source of the winning design from the lab, so it can be lifted rather than rebuilt.

## Status

Built on 2026-09-29: tokens and display font, the data layer (series, calendar, hour grid, verdict, score, all with tests), the chart components, the new report layout for wallet, sample and journal pages, the share card palette, the loading state and print fixes. Still open: the NeuroX score formula (see Open Decisions), which currently floors losing wallets at or near 0.

## Files to Change

- [ ] `src/app/globals.css`: replace the accent tokens with the logo palette (see Design Tokens). This restyles the landing, compare and journal pages too, which is intended.
- [ ] `src/app/layout.tsx`: load the Unbounded display font app-wide as `--font-nx-display`.
- [ ] `src/lib/analytics/types.ts`: add `series`, `drawdownSeries`, `calendar`, `hourWeekday`, `score`, `subScores` and `verdict` to `WalletReport`.
- [ ] `src/lib/analytics/visuals.ts` (new): move the derivations from the lab's `fixtures.ts` here and make them source-agnostic.
- [ ] `src/lib/analytics/score.ts` (new): the NeuroX score, once the formula is decided (see Open Decisions).
- [ ] `src/lib/analytics/index.ts`: have `buildReport` populate the new fields.
- [ ] `src/components/report/charts/` (new): `equity-explorer.tsx`, `tip-layer.tsx`, `calendar-heatmap.tsx`, `hour-heatmap.tsx`, `score-ring.tsx`, `neural-field.tsx`, from the appendix.
- [ ] `src/components/report/report-view.tsx`: rebuild the layout as Variant E.
- [ ] `src/components/report/report.module.css`: replace it with Variant E's styles plus styles for the sections E did not cover.
- [ ] `src/components/report/equity-chart.tsx` and `bar-chart.tsx`: remove once replaced.
- [ ] `src/components/share/report-card.tsx`: align the share card with the new P&L gradient and palette.
- [ ] `src/app/wallet/[address]/loading.tsx`: a loading state using the node motif.

## Implementation Steps

1. **Tokens first.** Swap `--accent*` in `globals.css` for the `--nx-*` tokens in the appendix (`theme.module.css`), keeping the existing variable names as aliases while pages migrate. Check contrast on every text colour.
2. **Display font.** Add `Unbounded` in `layout.tsx` next to Inter and JetBrains Mono, as `variable: "--font-nx-display"`.
3. **Data layer.** Port `loadLabData` from `fixtures.ts` into `buildReport`, working from the report's own fills rather than demo data:
   - `series`: walk every fill in time order with `running += closedPnl - fee`, and record a point when each trade's last closing fill lands. **Include opening fees.** The lab first skipped them and the curve ended $38 away from the headline P&L.
   - `drawdownSeries`: `running - peak` at each recorded point.
   - `calendar`: net P&L per UTC day from every fill, and closed-trade count per day. It must sum to `summary.netPnl`.
   - `hourWeekday`: 7 by 24 grid of closed-trade P&L and counts, Monday first, in UTC.
   - `verdict`: the sentence builder from `fixtures.ts`, extended to cover every caution insight id.
   - `score` and `subScores`: pending the formula decision.
4. **Charts.** Move the chart primitives from the appendix into `src/components/report/charts/`. `EquityExplorer` and `TipLayer` are client components; the rest render on the server.
5. **Report layout.** Rebuild `report-view.tsx` as Variant E:
   - Hero: node field, eyebrow, P&L, verdict, actions, score ring and sub-scores.
   - Signals: the top three insights.
   - Trajectory: a metrics row and the `EquityExplorer`.
   - Rhythm: calendar and hour heatmaps, each wrapped in `TipLayer`.
6. **Keep every existing section**, restyled in E's language (glass panels, wide-tracked caps titles): the remaining insights, holding time, risk and what-ifs, stock tokens, markets table and recent trades. Variant E only covered the top of the page.
7. **Notices** (sample data, truncated history, approximate pricing) become slim banners under the hero.
8. **Share card and loading state** updated to match.
9. **Delete** the old chart components and unused CSS.

## Component API

- **`EquityExplorer`** (client)
  - Props: `id: string`, `series: SeriesPoint[]`, `drawdown: { t; v }[]`, `height?: number` (260), `drawdownHeight?: number` (64), `glow?: boolean`, `color?: string` (cyan).
  - State: `active: number | null`, the index of the highlighted trade.
  - Events: pointer move snaps to the nearest trade by time (binary search); pointer leave clears. Arrow keys step, Home and End jump, focus selects the last trade. An `aria-live` region announces the active trade.
- **`TipLayer`** (client)
  - Props: `children`, a server-rendered SVG whose elements carry `data-tip="Title|value|detail"`.
  - Behaviour: shows a styled tooltip above the hovered element, colours the value by its sign, and flips near the edges.
- **`CalendarHeatmap`, `HourWeekdayHeatmap`**
  - Props: data, `cell`, `gap`, `tips?: boolean`. With `tips`, cells get `data-tip`; otherwise they use a native `<title>`.
- **`ScoreRing`**
  - Props: `id`, `score`, `size`, `stroke`, `glow`, `caption`. Blue-to-cyan gradient stroke.
- **`NeuralField`**
  - Decorative and `aria-hidden`. Deterministic node positions so server and client render match.

## Required UI States

- **Loading:** a skeleton of the hero with the node field animating. A later step could stream the real stages ("Reading transfers", "Rebuilding swaps", "Pricing in USD").
- **Empty (no trades):** keep the hero shell, with the node field dimmed and a clear message and next step. Hide the score.
- **Error:** the existing `ReportError` messages, restyled in the new palette.
- **Small sample:** show the score with a "Low confidence" tag under 20 trades, and keep the existing small-sample insight.
- **Partial data:** holding time, risk and stock sections render only when their data exists, as today.
- **Negative P&L:** coral gradient on the P&L and coral chart colour, with no other layout change.

## Accessibility Checklist

- [ ] `EquityExplorer` is focusable, steps with the arrow keys and announces each trade (built in the appendix version).
- [ ] Visible focus: 2px cyan outline with offset.
- [ ] Heatmap values are available without hover. Add a text summary, or a data table disclosure, per chart.
- [ ] Gain and loss are never shown by colour alone: values carry a `+` or `-` sign.
- [ ] Contrast of `--nx-muted` and `--nx-dim` on the new surfaces meets WCAG AA for text (check `--nx-dim`, which may need lightening).
- [ ] Node field and tooltip animations respect `prefers-reduced-motion` (handled in the theme).
- [ ] Touch targets are at least 44px (buttons are).

## Testing Checklist

- [ ] Unit test: the `series` final value equals `summary.netPnl` to the cent.
- [ ] Unit test: the `calendar` sums to `summary.netPnl`.
- [ ] Unit test: drawdown is always zero or negative and is zero at each new high.
- [ ] Unit test: the hour-by-weekday grid uses UTC and puts Monday first.
- [ ] Unit test: the verdict covers each caution insight and positive and negative P&L.
- [ ] Unit test: score bounds are 0 to 100 and sub-scores behave sensibly on empty and one-trade wallets.
- [ ] Component check: tooltips flip at the edges, clear on leave, and keyboard stepping works.
- [ ] Visual check at 390px, 768px and 1280px, including the stacked hero on mobile.
- [ ] Real wallet smoke test on Robinhood Chain and Solana.

## Design Tokens

New, from the logo (full list in the appendix, `theme.module.css`):

- **Background:** `--nx-bg #05070b`, `--nx-surface #0d121b`, `--nx-surface-2 #121926`, `--nx-surface-3 #182133`
- **Lines:** `--nx-line rgb(120 160 255 / 0.1)`, `--nx-line-strong rgb(120 160 255 / 0.2)`
- **Brand:** `--nx-blue #1f8bff`, `--nx-blue-bright #4aa8ff`, `--nx-cyan #5fd8ff`
- **Gradients:** `--nx-electric` (blue into cyan), `--nx-chrome` (white into light blue)
- **Semantic:** `--nx-gain #2fe0a4`, `--nx-loss #ff6b7a`, `--nx-caution #ffc05c`
- **Display type:** `--nx-display` (Unbounded)
- **P&L gradient:** `#ffffff` into `#8ff3c9` (gain) or into `#ffb0b8` (loss)

## Open Decisions

1. **NeuroX score formula.** The lab used a placeholder:
   - Edge from profit factor, weighted 40%.
   - Risk from recovery factor, weighted 30%.
   - Discipline from tilt and loss streaks, weighted 30%.

   It needs a real definition before it ships, because users will compare scores.
2. **Hero on mobile.** E stacks the score below the P&L. Consider a smaller ring beside the P&L on phones.
3. **Old report sections.** Decide the order for holding time, risk, stock tokens, markets and trades below Rhythm. Suggested: Signals (all), Holding, Risk, Stocks, Markets, Trades.

---

_Generated by Design Lab_

## Appendix: Reference Source From the Lab

The files below are the verified lab implementation of the winning design, copied before the lab was deleted. Paths are where they lived in the lab. Imports use the `_lab/` layout and need adjusting when moved.

### `_lab/theme.module.css`

```css
/*
 * Tokens derived from the NeuroX logo: electric blue, cyan glow and white chrome on
 * near-black. Scoped to .theme so the lab never changes the real app.
 */
.theme {
  --nx-bg: #05070b;
  --nx-bg-raised: #0a0e15;
  --nx-surface: #0d121b;
  --nx-surface-2: #121926;
  --nx-surface-3: #182133;
  --nx-line: rgb(120 160 255 / 0.1);
  --nx-line-strong: rgb(120 160 255 / 0.2);

  --nx-text: #eef3ff;
  --nx-text-2: #b8c4dc;
  --nx-muted: #7d8aa5;
  --nx-dim: #54607a;

  --nx-blue: #1f8bff;
  --nx-blue-bright: #4aa8ff;
  --nx-cyan: #5fd8ff;
  --nx-chrome: linear-gradient(180deg, #ffffff 0%, #cfe3ff 55%, #7fb4ff 100%);
  --nx-electric: linear-gradient(135deg, #1f8bff 0%, #5fd8ff 100%);
  --nx-blue-soft: rgb(31 139 255 / 0.12);
  --nx-glow: 0 0 0 1px rgb(74 168 255 / 0.25), 0 8px 40px -8px rgb(31 139 255 / 0.45);

  --nx-gain: #2fe0a4;
  --nx-gain-soft: rgb(47 224 164 / 0.12);
  --nx-loss: #ff6b7a;
  --nx-loss-soft: rgb(255 107 122 / 0.12);
  --nx-caution: #ffc05c;
  --nx-caution-soft: rgb(255 192 92 / 0.12);

  --nx-radius: 16px;
  --nx-radius-sm: 10px;
  --nx-display: var(--font-nx-display), var(--font-inter), system-ui, sans-serif;

  color: var(--nx-text);
  background: var(--nx-bg);
  font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

.theme :focus-visible {
  outline: 2px solid var(--nx-cyan);
  outline-offset: 2px;
  border-radius: 6px;
}

/* Shared chart helpers */
.chart { display: block; width: 100%; height: auto; overflow: visible; }
.axisLabel { fill: var(--nx-dim); font-size: 11px; font-family: var(--font-inter), system-ui, sans-serif; }
.num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.gain { color: var(--nx-gain); }
.loss { color: var(--nx-loss); }

@media (prefers-reduced-motion: reduce) {
  .theme *, .theme *::before, .theme *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### `_lab/interactive.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { formatDateTime, formatShortDate, formatUsd } from "@/lib/format";
import type { SeriesPoint } from "./fixtures";
import theme from "./theme.module.css";
import styles from "./interactive.module.css";

const W = 800;
const PAD_X = 8;

interface ExplorerProps {
  id: string;
  series: SeriesPoint[];
  drawdown: { t: number; v: number }[];
  height?: number;
  drawdownHeight?: number;
  glow?: boolean;
  color?: string;
}

/**
 * Equity curve with the drawdown band underneath, sharing one crosshair. Hover, touch or use
 * the arrow keys to step through trades; the tooltip shows the trade, the running total and
 * how far below the previous high the wallet was at that moment.
 */
export function EquityExplorer({ id, series, drawdown, height = 260, drawdownHeight = 64, glow = false, color = "var(--nx-cyan)" }: ExplorerProps) {
  const [active, setActive] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const gap = 14;
  const labels = 22;
  const total = height + gap + drawdownHeight + labels;
  const eqTop = 12;
  const eqBottom = height - 4;
  const ddTop = height + gap;

  const values = series.map((point) => point.v);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const ddMin = Math.min(-1, ...drawdown.map((point) => point.v));
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const maxAbs = Math.max(...series.map((point) => Math.abs(point.pnl)));

  const x = (t: number) => PAD_X + ((t - t0) / (t1 - t0 || 1)) * (W - PAD_X * 2);
  const y = (v: number) => eqTop + (1 - (v - min) / (max - min || 1)) * (eqBottom - eqTop);
  const yd = (v: number) => ddTop + (v / ddMin) * (drawdownHeight - 4);

  const line = series.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)} ${y(0).toFixed(1)} L${x(t0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const ddLine = drawdown.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${yd(point.v).toFixed(1)}`).join(" ");

  /** Index of the trade closest in time to a horizontal position. */
  function nearest(ratio: number): number {
    const t = t0 + ((ratio * W - PAD_X) / (W - PAD_X * 2)) * (t1 - t0);
    let low = 0;
    let high = series.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (series[mid].t < t) low = mid + 1;
      else high = mid;
    }
    return low > 0 && Math.abs(series[low - 1].t - t) < Math.abs(series[low].t - t) ? low - 1 : low;
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(nearest(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = series.length - 1;
    const current = active ?? last;
    const next =
      event.key === "ArrowRight" ? Math.min(last, current + 1)
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  const point = active === null ? null : series[active];
  const dd = active === null ? null : drawdown[active];
  const left = point ? (x(point.t) / W) * 100 : 0;
  const top = point ? (y(point.v) / total) * 100 : 0;
  const summary = point && dd
    ? `${formatDateTime(point.t)}. ${point.coin} ${formatUsd(point.pnl, { signed: true })}. Running total ${formatUsd(point.v, { signed: true })}. ${dd.v < 0 ? `${formatUsd(dd.v)} below the previous high.` : "At a new high."}`
    : "";

  return (
    <div
      ref={wrap}
      className={styles.explorer}
      tabIndex={0}
      role="group"
      aria-label={`Equity curve and drawdown from ${formatShortDate(t0)} to ${formatShortDate(t1)}, ending at ${formatUsd(series[series.length - 1].v, { signed: true })}. Use the left and right arrow keys to step through trades.`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((current) => current ?? series.length - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${W} ${total}`} className={theme.chart} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-dd`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--nx-loss)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--nx-loss)" stopOpacity="0.45" />
          </linearGradient>
          {glow ? (
            <filter id={`${id}-glow`} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
        </defs>

        <line x1={PAD_X} x2={W - PAD_X} y1={y(0)} y2={y(0)} stroke="var(--nx-line-strong)" strokeDasharray="3 5" />
        <path d={area} fill={`url(#${id}-area)`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" filter={glow ? `url(#${id}-glow)` : undefined} />
        {series.map((item, i) => (
          <circle
            key={i}
            cx={x(item.t)}
            cy={y(item.v)}
            r={i === active ? 6 : 1.6 + (Math.abs(item.pnl) / maxAbs) * 3.5}
            fill={item.pnl >= 0 ? "var(--nx-gain)" : "var(--nx-loss)"}
            fillOpacity={active === null || i === active ? 0.9 : 0.35}
            stroke={i === active ? "var(--nx-text)" : "var(--nx-bg)"}
            strokeWidth={i === active ? 2 : 1}
          />
        ))}

        <text x={PAD_X} y={ddTop - 3} className={theme.axisLabel}>Drawdown</text>
        <path d={`${ddLine} L${x(t1).toFixed(1)} ${ddTop} L${x(t0).toFixed(1)} ${ddTop} Z`} fill={`url(#${id}-dd)`} />
        <path d={ddLine} fill="none" stroke="var(--nx-loss)" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1={PAD_X} x2={W - PAD_X} y1={ddTop} y2={ddTop} stroke="var(--nx-line-strong)" />
        {dd ? <circle cx={x(dd.t)} cy={yd(dd.v)} r={4} fill="var(--nx-loss)" stroke="var(--nx-text)" strokeWidth="1.5" /> : null}

        <text x={PAD_X} y={total - 4} className={theme.axisLabel}>{formatShortDate(t0)}</text>
        <text x={W - PAD_X} y={total - 4} textAnchor="end" className={theme.axisLabel}>{formatShortDate(t1)}</text>
      </svg>

      {point && dd ? (
        <>
          <div className={styles.crosshair} style={{ left: `${left}%`, bottom: `${(labels / total) * 100}%` }} aria-hidden="true" />
          <div className={styles.tip} style={{ left: `${left}%`, top: `${top}%` }} data-side={left > 70 ? "left" : left < 30 ? "right" : "center"} data-v={top < 35 ? "below" : "above"} aria-hidden="true">
            <span className={styles.tipDate}>{formatDateTime(point.t)}</span>
            <span className={styles.tipRow}>
              <span>{point.coin}</span>
              <b className={`${theme.num} ${point.pnl >= 0 ? theme.gain : theme.loss}`}>{formatUsd(point.pnl, { signed: true })}</b>
            </span>
            <span className={styles.tipRow}>
              <span>Running total</span>
              <b className={`${theme.num} ${styles.plain}`}>{formatUsd(point.v, { signed: true })}</b>
            </span>
            <span className={styles.tipRow}>
              <span>Drawdown</span>
              <b className={`${theme.num} ${dd.v < 0 ? theme.loss : theme.gain}`}>{dd.v < 0 ? formatUsd(dd.v) : "New high"}</b>
            </span>
          </div>
        </>
      ) : null}
      <span className="sr-only" aria-live="polite">{summary}</span>
    </div>
  );
}

interface Tip {
  x: number;
  y: number;
  side: "left" | "right" | "center";
  lines: string[];
}

/**
 * Styled hover tooltips for any server-rendered chart whose elements carry `data-tip`
 * ("Title|value|detail"). The value is coloured by its sign.
 */
export function TipLayer({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest("[data-tip]") : null;
    if (!target || !wrap.current) return setTip(null);
    const cell = target.getBoundingClientRect();
    const box = wrap.current.getBoundingClientRect();
    const xPos = cell.left + cell.width / 2 - box.left;
    setTip({
      x: xPos,
      y: cell.top - box.top,
      side: xPos > box.width - 110 ? "left" : xPos < 110 ? "right" : "center",
      lines: (target.getAttribute("data-tip") ?? "").split("|"),
    });
  }

  const [title, value, detail] = tip?.lines ?? [];
  return (
    <div ref={wrap} className={styles.tipLayer} onPointerMove={onPointerMove} onPointerLeave={() => setTip(null)}>
      {children}
      {tip ? (
        <div className={`${styles.tip} ${styles.cellTip}`} style={{ left: tip.x, top: tip.y }} data-side={tip.side} aria-hidden="true">
          <span className={styles.tipDate}>{title}</span>
          {value ? <b className={`${theme.num} ${value.startsWith("+") ? theme.gain : value.startsWith("-") ? theme.loss : styles.plain}`}>{value}</b> : null}
          {detail ? <span className={styles.tipDetail}>{detail}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
```

### `_lab/interactive.module.css`

```css
.explorer { position: relative; touch-action: pan-y; cursor: crosshair; border-radius: 10px; }
.explorer:focus-visible { outline: 2px solid var(--nx-cyan); outline-offset: 6px; }

.crosshair {
  position: absolute;
  top: 0;
  width: 1px;
  margin-left: -0.5px;
  background: linear-gradient(180deg, transparent, rgb(95 216 255 / 0.55) 12%, rgb(95 216 255 / 0.55) 88%, transparent);
  pointer-events: none;
}

.tip {
  position: absolute;
  z-index: 3;
  display: grid;
  gap: 4px;
  min-width: 190px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgb(95 216 255 / 0.3);
  background: rgb(10 14 21 / 0.94);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 40px -12px rgb(0 0 0 / 0.9), 0 0 24px -12px rgb(31 139 255 / 0.8);
  font-size: 13px;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 14px));
  animation: tipIn 0.12s ease-out;
}
.tip[data-side="left"] { transform: translate(calc(-100% - 14px), -50%); }
.tip[data-side="right"] { transform: translate(14px, -50%); }
.tip[data-side="center"][data-v="below"] { transform: translate(-50%, 14px); }
@keyframes tipIn { from { opacity: 0; } }

.tipDate { color: var(--nx-muted); font-size: 12px; }
.tipRow { display: flex; justify-content: space-between; gap: 18px; color: var(--nx-text-2); }
/* Colour lives on the value's own class (gain, loss or plain), so no colour is set here to avoid out-ranking it. */
.tipRow b { font-weight: 600; }
.plain { color: var(--nx-text); }

.tipLayer { position: relative; }
.tipLayer [data-tip] { cursor: pointer; transition: stroke 0.1s; }
.tipLayer [data-tip]:hover { stroke: var(--nx-text); stroke-width: 1.5; }
.cellTip { min-width: 0; white-space: nowrap; transform: translate(-50%, calc(-100% - 8px)); }
.cellTip[data-side="left"] { transform: translate(calc(-100% + 8px), calc(-100% - 8px)); }
.cellTip[data-side="right"] { transform: translate(-8px, calc(-100% - 8px)); }
.cellTip b { font-size: 15px; font-weight: 600; }
.tipDetail { color: var(--nx-muted); font-size: 12px; }
```

### `_lab/charts.tsx`

```tsx
import { formatDuration, formatShortDate, formatUsd } from "@/lib/format";
import type { DayCell, HoldPoint, SeriesPoint } from "./fixtures";
import theme from "./theme.module.css";

/*
 * Shared SVG chart primitives. They take an `id` prefix for gradient and filter ids so the
 * same chart can appear several times on one page. Colours come from the lab's CSS variables.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Diverging fill for a P&L cell: green for profit, red for loss, stronger with size. */
export function pnlFill(pnl: number, maxAbs: number, trades = 1): string {
  if (!trades) return "var(--nx-surface-2)";
  if (pnl === 0 || maxAbs === 0) return "var(--nx-surface-3)";
  const strength = Math.min(1, Math.abs(pnl) / maxAbs);
  const alpha = 0.22 + strength * 0.78;
  return pnl > 0 ? `rgb(47 224 164 / ${alpha.toFixed(2)})` : `rgb(255 107 122 / ${alpha.toFixed(2)})`;
}

interface EquityProps {
  id: string;
  series: SeriesPoint[];
  width?: number;
  height?: number;
  markers?: boolean;
  glow?: boolean;
  color?: string;
  axis?: boolean;
}

export function EquityChart({ id, series, width = 800, height = 240, markers = false, glow = false, color = "var(--nx-blue-bright)", axis = true }: EquityProps) {
  const pad = { top: 12, right: 8, bottom: axis ? 22 : 6, left: 8 };
  const values = series.map((point) => point.v);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const x = (t: number) => pad.left + ((t - t0) / (t1 - t0 || 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const line = series.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)} ${y(0).toFixed(1)} L${x(t0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const maxAbs = Math.max(...series.map((point) => Math.abs(point.pnl)));
  const final = series[series.length - 1].v;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={theme.chart} role="img" aria-label={`Equity curve from ${formatShortDate(t0)} to ${formatShortDate(t1)}, ending at ${formatUsd(final, { signed: true })}`}>
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        {glow ? (
          <filter id={`${id}-glow`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="var(--nx-line-strong)" strokeDasharray="3 5" />
      <path d={area} fill={`url(#${id}-area)`} />
      <path d={line} fill="none" stroke={color} strokeWidth={glow ? 2.5 : 2} strokeLinejoin="round" filter={glow ? `url(#${id}-glow)` : undefined} />
      {markers
        ? series.map((point, i) => (
            <circle key={i} cx={x(point.t)} cy={y(point.v)} r={1.6 + (Math.abs(point.pnl) / maxAbs) * 4} fill={point.pnl >= 0 ? "var(--nx-gain)" : "var(--nx-loss)"} fillOpacity="0.85" stroke="var(--nx-bg)" strokeWidth="1">
              <title>{`${point.coin} ${formatUsd(point.pnl, { signed: true })} on ${formatShortDate(point.t)}`}</title>
            </circle>
          ))
        : null}
      {axis ? (
        <>
          <text x={pad.left} y={height - 4} className={theme.axisLabel}>{formatShortDate(t0)}</text>
          <text x={width - pad.right} y={height - 4} textAnchor="end" className={theme.axisLabel}>{formatShortDate(t1)}</text>
        </>
      ) : null}
    </svg>
  );
}

export function DrawdownChart({ id, drawdown, width = 800, height = 90 }: { id: string; drawdown: { t: number; v: number }[]; width?: number; height?: number }) {
  const min = Math.min(...drawdown.map((point) => point.v), -1);
  const t0 = drawdown[0].t;
  const t1 = drawdown[drawdown.length - 1].t;
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * width;
  const y = (v: number) => (v / min) * (height - 4);
  const line = drawdown.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={theme.chart} role="img" aria-label={`Drawdown chart. Deepest drawdown ${formatUsd(min)}`}>
      <defs>
        <linearGradient id={`${id}-dd`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--nx-loss)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--nx-loss)" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} 0 L0 0 Z`} fill={`url(#${id}-dd)`} />
      <path d={line} fill="none" stroke="var(--nx-loss)" strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="0" x2={width} y1="0.5" y2="0.5" stroke="var(--nx-line-strong)" />
    </svg>
  );
}

/** `tips` swaps native <title> tooltips for `data-tip` attributes, read by the client TipLayer. */
export function CalendarHeatmap({ days, cell = 14, gap = 3, labels = true, tips = false }: { days: DayCell[]; cell?: number; gap?: number; labels?: boolean; tips?: boolean }) {
  const weeks = Math.ceil(days.length / 7);
  const left = labels ? 30 : 0;
  const top = labels ? 16 : 0;
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.pnl)));
  const width = left + weeks * (cell + gap);
  const height = top + 7 * (cell + gap);
  const months = days.filter((day, i) => i % 7 === 0 && new Date(day.t).getUTCDate() <= 7);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={theme.chart} role="img" aria-label="Daily profit and loss calendar">
      {labels
        ? [0, 2, 4].map((row) => (
            <text key={row} x={0} y={top + row * (cell + gap) + cell - 3} className={theme.axisLabel}>{WEEKDAYS[row]}</text>
          ))
        : null}
      {labels
        ? months.map((day) => (
            <text key={day.t} x={left + Math.floor(days.indexOf(day) / 7) * (cell + gap)} y={11} className={theme.axisLabel}>
              {new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(day.t)}
            </text>
          ))
        : null}
      {days.map((day, i) => (
        <rect
          key={day.t}
          x={left + Math.floor(i / 7) * (cell + gap)}
          y={top + (i % 7) * (cell + gap)}
          width={cell}
          height={cell}
          rx={3}
          fill={pnlFill(day.pnl, maxAbs, day.trades)}
          data-tip={tips ? `${WEEKDAYS[i % 7]}, ${formatShortDate(day.t)}|${day.trades ? formatUsd(day.pnl, { signed: true }) : "No trades"}|${day.trades ? `${day.trades} ${day.trades === 1 ? "trade" : "trades"}` : ""}` : undefined}
        >
          {tips ? null : <title>{day.trades ? `${formatShortDate(day.t)}: ${formatUsd(day.pnl, { signed: true })} over ${day.trades} trades` : `${formatShortDate(day.t)}: no trades`}</title>}
        </rect>
      ))}
    </svg>
  );
}

export function HourWeekdayHeatmap({ grid, cell = 16, gap = 2, tips = false }: { grid: { pnl: number; trades: number }[][]; cell?: number; gap?: number; tips?: boolean }) {
  const left = 30;
  const top = 4;
  const bottom = 16;
  const maxAbs = Math.max(...grid.flat().map((slot) => Math.abs(slot.pnl)));
  const width = left + 24 * (cell + gap);
  const height = top + 7 * (cell + gap) + bottom;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={theme.chart} role="img" aria-label="Net profit and loss by hour of day and weekday, UTC">
      {grid.map((row, d) => (
        <g key={d}>
          <text x={0} y={top + d * (cell + gap) + cell - 4} className={theme.axisLabel}>{WEEKDAYS[d]}</text>
          {row.map((slot, h) => (
            <rect
              key={h}
              x={left + h * (cell + gap)}
              y={top + d * (cell + gap)}
              width={cell}
              height={cell}
              rx={3}
              fill={pnlFill(slot.pnl, maxAbs, slot.trades)}
              data-tip={tips ? `${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 UTC|${slot.trades ? formatUsd(slot.pnl, { signed: true }) : "No trades"}|${slot.trades ? `${slot.trades} ${slot.trades === 1 ? "trade" : "trades"}` : ""}` : undefined}
            >
              {tips ? null : <title>{`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 UTC: ${slot.trades ? `${formatUsd(slot.pnl, { signed: true })} over ${slot.trades} trades` : "no trades"}`}</title>}
            </rect>
          ))}
        </g>
      ))}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={left + h * (cell + gap)} y={height - 3} className={theme.axisLabel}>{String(h).padStart(2, "0")}</text>
      ))}
    </svg>
  );
}

export function ScoreRing({ id, score, size = 160, stroke = 12, glow = false, caption = "NeuroX score" }: { id: string; score: number; size?: number; stroke?: number; glow?: boolean; caption?: string }) {
  const radius = (size - stroke) / 2 - (glow ? 6 : 0);
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${caption}: ${score} out of 100`}>
      <defs>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--nx-blue)" />
          <stop offset="100%" stopColor="var(--nx-cyan)" />
        </linearGradient>
        {glow ? (
          <filter id={`${id}-ringglow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--nx-surface-3)" strokeWidth={stroke} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={`url(#${id}-ring)`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        filter={glow ? `url(#${id}-ringglow)` : undefined}
      />
      <text x={center} y={center + size * 0.02} textAnchor="middle" dominantBaseline="middle" fill="var(--nx-text)" style={{ font: `600 ${size * 0.3}px var(--nx-display)`, letterSpacing: "-0.02em" }}>
        {score}
      </text>
      <text x={center} y={center + size * 0.22} textAnchor="middle" fill="var(--nx-muted)" style={{ font: `500 ${Math.max(10, size * 0.07)}px var(--font-inter), system-ui` }}>
        of 100
      </text>
    </svg>
  );
}

export function HoldScatter({ holds, width = 800, height = 220 }: { holds: HoldPoint[]; width?: number; height?: number }) {
  const pad = { top: 10, right: 10, bottom: 22, left: 10 };
  const logs = holds.map((hold) => Math.log10(Math.max(60_000, hold.holdMs)));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const maxAbs = Math.max(...holds.map((hold) => Math.abs(hold.pnl)));
  const x = (ms: number) => pad.left + ((Math.log10(Math.max(60_000, ms)) - lo) / (hi - lo || 1)) * (width - pad.left - pad.right);
  const y = (pnl: number) => pad.top + (1 - (pnl + maxAbs) / (2 * maxAbs)) * (height - pad.top - pad.bottom);
  const ticks = [15 * 60_000, 3_600_000, 4 * 3_600_000, 12 * 3_600_000].filter((ms) => Math.log10(ms) >= lo && Math.log10(ms) <= hi);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={theme.chart} role="img" aria-label="Each trade by how long it was held and what it made">
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="var(--nx-line-strong)" strokeDasharray="3 5" />
      {holds.map((hold, i) => (
        <circle key={i} cx={x(hold.holdMs)} cy={y(hold.pnl)} r={3.5} fill={hold.pnl >= 0 ? "var(--nx-gain)" : "var(--nx-loss)"} fillOpacity="0.7">
          <title>{`${hold.coin}: ${formatUsd(hold.pnl, { signed: true })} after ${formatDuration(hold.holdMs)}`}</title>
        </circle>
      ))}
      {ticks.map((ms) => (
        <text key={ms} x={x(ms)} y={height - 4} textAnchor="middle" className={theme.axisLabel}>{formatDuration(ms)}</text>
      ))}
    </svg>
  );
}

/** The connected-nodes motif from the logo, as a decorative background layer. */
export function NeuralField({ width = 1200, height = 420, className }: { width?: number; height?: number; className?: string }) {
  // Fixed, deterministic points so server and client render identically.
  const nodes = [
    [80, 60], [210, 140], [330, 50], [460, 170], [560, 80], [700, 150], [820, 60], [950, 170], [1080, 90], [1150, 220],
    [140, 260], [300, 300], [520, 280], [660, 330], [880, 300], [1020, 350], [400, 390], [760, 400],
  ];
  const links = [
    [0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [1, 10], [10, 11], [11, 3],
    [11, 12], [12, 13], [13, 5], [13, 14], [14, 7], [14, 15], [15, 9], [12, 16], [16, 11], [13, 17], [17, 14],
  ];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="var(--nx-blue-bright)" strokeOpacity="0.14" strokeWidth="1" />
      ))}
      {nodes.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 4 === 0 ? 3.5 : 2.2} fill="var(--nx-cyan)" fillOpacity={i % 4 === 0 ? 0.7 : 0.35} />
      ))}
    </svg>
  );
}
```

### `_lab/VariantE.tsx`

```tsx
import { formatPercent, formatRatio, formatUsd, pluralise } from "@/lib/format";
import { CalendarHeatmap, HourWeekdayHeatmap, NeuralField, ScoreRing } from "./charts";
import type { LabData } from "./fixtures";
import { EquityExplorer, TipLayer } from "./interactive";
import theme from "./theme.module.css";
import styles from "./VariantE.module.css";

/** Variant E: expressive. The logo's neural, electric identity carried through the whole report. */
export function VariantE({ data }: { data: LabData }) {
  const { report, verdict, score, subScores, topInsights, series, drawdown, calendar, hourWeekday } = data;
  const { summary } = report;

  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <NeuralField className={styles.field} />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              NEURO<b>X</b> REPORT <span>{report.subject.label}</span>
            </p>
            <strong className={`${styles.pnl} ${theme.num}`} data-tone={summary.netPnl >= 0 ? "gain" : "loss"}>
              {formatUsd(summary.netPnl, { signed: true })}
            </strong>
            <p className={styles.pnlLabel}>Net realized P&amp;L · {pluralise(summary.tradeCount, "trade")}</p>
            <p className={styles.verdict}>{verdict}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary}>Share your card</button>
              <button type="button" className={styles.ghost}>Compare</button>
            </div>
          </div>

          <div className={styles.scoreCol}>
            <div className={styles.ringWrap}>
              <ScoreRing id="e-score" score={score} size={220} stroke={14} glow />
            </div>
            <ul className={styles.subs}>
              {subScores.map((sub) => (
                <li key={sub.key}>
                  <span className={styles.node} aria-hidden="true" />
                  <span className={styles.subLabel}>{sub.label}</span>
                  <b className={theme.num}>{sub.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="e-signals">
        <h2 id="e-signals" className={styles.sectionTitle}>SIGNALS</h2>
        <div className={styles.constellation}>
          <svg className={styles.links} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M160 20 C 330 0, 500 40, 500 20 S 670 0, 840 20" stroke="url(#e-link)" strokeWidth="1.5" fill="none" />
            <defs>
              <linearGradient id="e-link" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--nx-gain)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="var(--nx-caution)" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>
          {topInsights.map((insight) => (
            <div key={insight.id} className={styles.signal} data-tone={insight.tone}>
              <span className={styles.signalNode} aria-hidden="true" />
              <span className={styles.signalTag}>{insight.tone === "positive" ? "Strength" : insight.tone === "caution" ? "Leak" : "Note"}</span>
              <h3>{insight.title}</h3>
              <p>{insight.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="e-trajectory">
        <h2 id="e-trajectory" className={styles.sectionTitle}>TRAJECTORY</h2>
        <div className={styles.glass}>
          <div className={styles.metricsRow}>
            <span>Win rate <b className={theme.num}>{formatPercent(summary.winRate)}</b></span>
            <span>Profit factor <b className={theme.num}>{formatRatio(summary.profitFactor)}</b></span>
            <span>Per trade <b className={theme.num}>{formatUsd(summary.expectancy, { signed: true })}</b></span>
            <span>Max drawdown <b className={`${theme.num} ${theme.loss}`}>{formatUsd(-summary.maxDrawdown, { compact: true })}</b></span>
          </div>
          <EquityExplorer id="e-equity" series={series} drawdown={drawdown} height={260} glow />
          <p className={styles.chartHint}>Hover, tap or use the arrow keys to see each trade.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="e-rhythm">
        <h2 id="e-rhythm" className={styles.sectionTitle}>RHYTHM</h2>
        <div className={styles.twoUp}>
          <div className={styles.glass}>
            <span className={styles.panelLabel}>Every day</span>
            <TipLayer>
              <CalendarHeatmap days={calendar} cell={14} tips />
            </TipLayer>
          </div>
          <div className={styles.glass}>
            <span className={styles.panelLabel}>Every hour (UTC)</span>
            <TipLayer>
              <HourWeekdayHeatmap grid={hourWeekday} cell={13} tips />
            </TipLayer>
          </div>
        </div>
      </section>
    </article>
  );
}
```

### `_lab/VariantE.module.css`

```css
.page { display: grid; gap: 64px; padding-bottom: 72px; }

.hero {
  position: relative;
  overflow: hidden;
  padding: 72px 24px 64px;
  border-bottom: 1px solid var(--nx-line);
  background: radial-gradient(70% 90% at 70% 40%, rgb(31 139 255 / 0.22), transparent 70%), var(--nx-bg);
}
.field { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.9; }
.field circle { animation: pulse 3.2s ease-in-out infinite alternate; }
.field circle:nth-child(3n) { animation-delay: -1.1s; }
.field circle:nth-child(3n + 1) { animation-delay: -2.2s; }
@keyframes pulse { to { opacity: 0.25; } }

.heroInner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  align-items: center;
  gap: 40px;
  max-width: 1120px;
  margin: 0 auto;
  animation: rise 0.6s ease-out;
}
@keyframes rise { from { opacity: 0; transform: translateY(14px); } }

.heroCopy { display: grid; gap: 12px; }
.eyebrow { margin: 0; font: 600 12px var(--nx-display); letter-spacing: 0.32em; color: var(--nx-text); }
.eyebrow b { color: var(--nx-blue-bright); font-weight: 600; }
.eyebrow span { margin-left: 14px; font: 500 12px var(--font-mono-face), ui-monospace, monospace; letter-spacing: 0; color: var(--nx-muted); }
/* Variant A's P&L treatment, as requested: display face, tight tracking, white into the result colour. */
.pnl {
  font-family: var(--nx-display);
  font-size: clamp(40px, 6vw, 64px);
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.03em;
  background: linear-gradient(180deg, #ffffff, #8ff3c9);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.pnl[data-tone="loss"] { background-image: linear-gradient(180deg, #ffffff, #ffb0b8); }
.pnlLabel { margin: 0; color: var(--nx-muted); font-size: 14px; }
.verdict { margin: 8px 0 0; max-width: 520px; color: var(--nx-text-2); font-size: 18px; line-height: 1.5; text-wrap: balance; }

.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.primary, .ghost { min-height: 46px; padding: 0 22px; border-radius: 999px; font: 600 14.5px var(--font-inter), system-ui; transition: transform 0.15s ease-out, box-shadow 0.2s; }
.primary { border: 0; background: var(--nx-electric); color: #031022; box-shadow: 0 0 30px -6px rgb(31 139 255 / 0.8); }
.primary:hover { transform: translateY(-1px); box-shadow: 0 0 40px -4px rgb(95 216 255 / 0.9); }
.ghost { border: 1px solid rgb(95 216 255 / 0.35); background: rgb(5 7 11 / 0.5); color: var(--nx-text); backdrop-filter: blur(8px); }

.scoreCol { display: grid; justify-items: center; gap: 18px; }
.ringWrap { padding: 18px; border-radius: 50%; background: radial-gradient(circle, rgb(31 139 255 / 0.2), transparent 70%); }
.subs { display: grid; grid-template-columns: repeat(3, auto); gap: 10px; margin: 0; padding: 0; list-style: none; }
.subs li {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 96px;
  padding: 12px 10px;
  border-radius: 14px;
  border: 1px solid var(--nx-line-strong);
  background: rgb(10 14 21 / 0.7);
  backdrop-filter: blur(10px);
}
.node { width: 7px; height: 7px; border-radius: 50%; background: var(--nx-cyan); box-shadow: 0 0 10px var(--nx-cyan); }
.subLabel { color: var(--nx-muted); font-size: 11.5px; }
.subs b { font-size: 20px; font-weight: 600; }

.section { display: grid; gap: 18px; max-width: 1120px; width: 100%; margin: 0 auto; padding: 0 24px; }
.sectionTitle { margin: 0; font: 600 13px var(--nx-display); letter-spacing: 0.4em; color: var(--nx-muted); }

.constellation { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; padding-top: 22px; }
.links { position: absolute; top: 0; left: 0; width: 100%; height: 40px; }
.signal {
  position: relative;
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 26px 22px 22px;
  border-radius: 20px;
  border: 1px solid var(--nx-line-strong);
  background: linear-gradient(180deg, rgb(18 25 38 / 0.9), rgb(10 14 21 / 0.9));
  transition: transform 0.2s ease-out, border-color 0.2s, box-shadow 0.2s;
}
.signal:hover { transform: translateY(-3px); border-color: rgb(95 216 255 / 0.4); box-shadow: 0 20px 60px -30px rgb(31 139 255 / 0.8); }
.signalNode { position: absolute; top: -7px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; border: 3px solid var(--nx-bg); background: var(--nx-blue-bright); box-shadow: 0 0 14px var(--nx-blue-bright); }
.signal[data-tone="positive"] .signalNode { background: var(--nx-gain); box-shadow: 0 0 14px var(--nx-gain); }
.signal[data-tone="caution"] .signalNode { background: var(--nx-caution); box-shadow: 0 0 14px var(--nx-caution); }
.signalTag { font: 600 10.5px var(--nx-display); letter-spacing: 0.25em; text-transform: uppercase; color: var(--nx-muted); }
.signal[data-tone="positive"] .signalTag { color: var(--nx-gain); }
.signal[data-tone="caution"] .signalTag { color: var(--nx-caution); }
.signal h3 { margin: 0; font-size: 17px; line-height: 1.3; }
.signal p { margin: 0; color: var(--nx-text-2); font-size: 14px; line-height: 1.55; }

.glass {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 22px;
  border-radius: 20px;
  border: 1px solid var(--nx-line-strong);
  background: linear-gradient(180deg, rgb(18 25 38 / 0.75), rgb(10 14 21 / 0.75));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
}
.metricsRow { display: flex; flex-wrap: wrap; gap: 8px 28px; margin-bottom: 8px; color: var(--nx-muted); font-size: 13.5px; }
.metricsRow b { margin-left: 6px; color: var(--nx-text); font-weight: 600; }
.twoUp { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.panelLabel { color: var(--nx-muted); font-size: 12.5px; }
.chartHint { margin: 4px 0 0; color: var(--nx-dim); font-size: 12.5px; }

@media (max-width: 860px) {
  .heroInner, .constellation, .twoUp { grid-template-columns: 1fr; }
  .links { display: none; }
  .hero { padding-top: 44px; }
  .page { gap: 44px; }
}
@media (max-width: 420px) {
  .subs { grid-template-columns: 1fr; width: 100%; }
}
```

### `_lab/fixtures.ts`

```ts
import { buildTrades } from "@/lib/analytics/trades";
import type { Insight, WalletReport } from "@/lib/analytics/types";
import { generateDemoFills } from "@/lib/demo/generate";
import { loadDemoReport } from "@/lib/report";

/**
 * Shared data for every Design Lab variant, derived from the real sample wallet so the
 * comparison is fair and the numbers are realistic. Everything here is plain and
 * serialisable, so client-side variants can receive it as props.
 */

const DAY = 86_400_000;

export interface SeriesPoint {
  t: number;
  /** Cumulative realized P&L after this trade. */
  v: number;
  /** This trade's own P&L. */
  pnl: number;
  coin: string;
}

export interface DayCell {
  t: number;
  pnl: number;
  trades: number;
}

export interface HoldPoint {
  holdMs: number;
  pnl: number;
  coin: string;
}

export interface SubScore {
  key: "edge" | "risk" | "discipline";
  label: string;
  value: number;
  blurb: string;
}

export interface LabData {
  report: WalletReport;
  verdict: string;
  score: number;
  subScores: SubScore[];
  topInsights: Insight[];
  series: SeriesPoint[];
  /** Distance below the running peak after each trade, always zero or negative. */
  drawdown: { t: number; v: number }[];
  /** One cell per calendar day from the Monday before the first trade to the last trade. */
  calendar: DayCell[];
  /** [weekday 0 = Monday][hour 0 to 23] */
  hourWeekday: { pnl: number; trades: number }[][];
  holds: HoldPoint[];
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/** Short clauses for the verdict sentence, keyed by insight id. */
const CAUTION_PHRASES: Record<string, (insight: Insight) => string> = {
  "size-after-loss": () => "you size up after losses",
  "worst-hour": () => "late sessions give some back",
  "worst-asset": (insight) => `${insight.title.split(" ")[0]} keeps leaking money`,
  "fee-drag": () => "fees eat into your gains",
  "loss-streak": () => "losing streaks run long",
  "hold-losers": () => "you hold losers too long",
};

function buildVerdict(report: WalletReport): string {
  const { summary } = report;
  const opening =
    summary.netPnl > 0 && (summary.profitFactor ?? 0) >= 1.2
      ? "Profitable with a real edge"
      : summary.netPnl > 0
        ? "Profitable, but only just"
        : "Losing money overall";
  const cautions = report.insights
    .filter((insight) => insight.tone === "caution" && CAUTION_PHRASES[insight.id])
    .slice(0, 2)
    .map((insight) => CAUTION_PHRASES[insight.id](insight));
  return cautions.length ? `${opening}, but ${cautions.join(" and ")}.` : `${opening}.`;
}

/**
 * A prototype of the NeuroX score. Not a production formula: it exists so the variants can
 * show how a score looks and reads. Edge rewards profit factor, risk rewards recovering from
 * drawdowns, discipline penalises sizing up after losses and long losing streaks.
 */
function buildScore(report: WalletReport): { score: number; subScores: SubScore[] } {
  const { summary, risk } = report;
  const edge = clamp((((summary.profitFactor ?? 0) - 0.5) / 1.5) * 100);
  const riskScore = clamp(((risk?.recoveryFactor ?? 0) / 5) * 100);
  const tilt = report.insights.some((insight) => insight.id === "size-after-loss");
  const discipline = clamp(100 - (tilt ? 30 : 0) - Math.max(0, summary.longestLossStreak - 3) * 4);

  const subScores: SubScore[] = [
    { key: "edge", label: "Edge", value: Math.round(edge), blurb: `Profit factor ${(summary.profitFactor ?? 0).toFixed(2)}` },
    { key: "risk", label: "Risk control", value: Math.round(riskScore), blurb: `Recovered ${(risk?.recoveryFactor ?? 0).toFixed(1)}x its worst drawdown` },
    { key: "discipline", label: "Discipline", value: Math.round(discipline), blurb: tilt ? "Sizes up after losses" : "Steady sizing" },
  ];
  return { score: Math.round(edge * 0.4 + riskScore * 0.3 + discipline * 0.3), subScores };
}

export function loadLabData(): LabData {
  const report = loadDemoReport("demo");
  const fills = [...generateDemoFills("active")].sort((a, b) => a.time - b.time);
  const trades = buildTrades(fills);

  // The running total walks every fill, opening fees included, so the curve ends exactly on the
  // headline net P&L. A point is recorded when each trade's last closing fill lands.
  const tradeByKey = new Map(trades.map((trade) => [trade.id, trade]));
  const recorded = new Set<string>();
  let running = 0;
  let peak = 0;
  const series: SeriesPoint[] = [];
  const drawdown: { t: number; v: number }[] = [];
  const byDay = new Map<number, DayCell>();
  for (const fill of fills) {
    const net = fill.closedPnl - fill.fee;
    running += net;
    peak = Math.max(peak, running);

    const day = Math.floor(fill.time / DAY) * DAY;
    const cell = byDay.get(day) ?? { t: day, pnl: 0, trades: 0 };
    cell.pnl += net;
    byDay.set(day, cell);

    const key = `${fill.coin}:${fill.orderId}`;
    const trade = tradeByKey.get(key);
    if (trade && fill.time === trade.closedAt && !recorded.has(key)) {
      recorded.add(key);
      cell.trades += 1;
      series.push({ t: trade.closedAt, v: running, pnl: trade.pnl, coin: trade.coin });
      drawdown.push({ t: trade.closedAt, v: running - peak });
    }
  }

  // Calendar, starting on the Monday on or before the first trade.
  const firstDay = Math.floor(trades[0].closedAt / DAY) * DAY;
  const mondayOffset = (new Date(firstDay).getUTCDay() + 6) % 7;
  const start = firstDay - mondayOffset * DAY;
  const end = Math.floor(trades[trades.length - 1].closedAt / DAY) * DAY;
  const calendar: DayCell[] = [];
  for (let day = start; day <= end; day += DAY) calendar.push(byDay.get(day) ?? { t: day, pnl: 0, trades: 0 });

  const hourWeekday = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ pnl: 0, trades: 0 })));
  for (const trade of trades) {
    const date = new Date(trade.closedAt);
    const cell = hourWeekday[(date.getUTCDay() + 6) % 7][date.getUTCHours()];
    cell.pnl += trade.pnl;
    cell.trades += 1;
  }

  const holds = trades
    .filter((trade) => trade.openedAt !== undefined)
    .map((trade) => ({ holdMs: trade.closedAt - (trade.openedAt as number), pnl: trade.pnl, coin: trade.coin }));

  const positive = report.insights.find((insight) => insight.tone === "positive");
  const cautions = report.insights.filter((insight) => insight.tone === "caution").slice(0, positive ? 2 : 3);
  const { score, subScores } = buildScore(report);

  return {
    report,
    verdict: buildVerdict(report),
    score,
    subScores,
    topInsights: positive ? [positive, ...cautions] : cautions,
    series,
    drawdown,
    calendar,
    hourWeekday,
    holds,
  };
}
```
