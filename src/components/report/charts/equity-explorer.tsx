"use client";

import { useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { TradePoint } from "@/lib/analytics/types";
import { formatDateTime, formatShortDate, formatUsd } from "@/lib/format";
import charts from "./charts.module.css";
import styles from "./interactive.module.css";

const W = 800;
const PAD_X = 8;

interface ExplorerProps {
  id: string;
  series: TradePoint[];
  height?: number;
  drawdownHeight?: number;
  glow?: boolean;
  color?: string;
}

/**
 * Equity curve with the drawdown band underneath, sharing one crosshair. Hover, tap or use the
 * arrow keys (Home and End jump to the ends) to step through trades. The tooltip shows the
 * trade, the running total and how far below the previous high the wallet was at that moment.
 */
export function EquityExplorer({ id, series, height = 260, drawdownHeight = 64, glow = false, color = "var(--cyan)" }: ExplorerProps) {
  const [active, setActive] = useState<number | null>(null);

  const gap = 14;
  const labels = 22;
  const total = height + gap + drawdownHeight + labels;
  const eqTop = 12;
  const eqBottom = height - 4;
  const ddTop = height + gap;

  const values = series.map((point) => point.v);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const ddMin = Math.min(-1, ...series.map((point) => point.drawdown));
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const maxAbs = Math.max(1e-9, ...series.map((point) => Math.abs(point.pnl)));
  const final = series[series.length - 1].v;

  const x = (t: number) => PAD_X + ((t - t0) / (t1 - t0 || 1)) * (W - PAD_X * 2);
  const y = (v: number) => eqTop + (1 - (v - min) / (max - min || 1)) * (eqBottom - eqTop);
  const yd = (v: number) => ddTop + (v / ddMin) * (drawdownHeight - 4);

  const line = series.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)} ${y(0).toFixed(1)} L${x(t0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const ddLine = series.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${yd(point.drawdown).toFixed(1)}`).join(" ");

  /** Index of the trade closest in time to a horizontal position (0 to 1 across the chart). */
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
  const left = point ? (x(point.t) / W) * 100 : 0;
  const top = point ? (y(point.v) / total) * 100 : 0;
  const announcement = point
    ? `${formatDateTime(point.t)}. ${point.coin} ${formatUsd(point.pnl, { signed: true })}. Running total ${formatUsd(point.v, { signed: true })}. ${point.drawdown < 0 ? `${formatUsd(point.drawdown)} below the previous high.` : "At a new high."}`
    : "";

  return (
    <div
      className={styles.explorer}
      tabIndex={0}
      role="group"
      aria-label={`Equity curve and drawdown from ${formatShortDate(t0)} to ${formatShortDate(t1)}, ending at ${formatUsd(final, { signed: true })}. Use the left and right arrow keys to step through trades.`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((current) => current ?? series.length - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${W} ${total}`} className={charts.chart} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-dd`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--loss)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--loss)" stopOpacity="0.45" />
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

        <line x1={PAD_X} x2={W - PAD_X} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeDasharray="3 5" />
        <path d={area} fill={`url(#${id}-area)`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" filter={glow ? `url(#${id}-glow)` : undefined} />
        {series.map((item, i) => (
          <circle
            key={i}
            cx={x(item.t)}
            cy={y(item.v)}
            r={i === active ? 6 : 1.6 + (Math.abs(item.pnl) / maxAbs) * 3.5}
            fill={item.pnl >= 0 ? "var(--gain)" : "var(--loss)"}
            fillOpacity={active === null || i === active ? 0.9 : 0.35}
            stroke={i === active ? "var(--text)" : "var(--bg)"}
            strokeWidth={i === active ? 2 : 1}
          />
        ))}

        <text x={PAD_X} y={ddTop - 3} className={charts.axisLabel}>Drawdown</text>
        <path d={`${ddLine} L${x(t1).toFixed(1)} ${ddTop} L${x(t0).toFixed(1)} ${ddTop} Z`} fill={`url(#${id}-dd)`} />
        <path d={ddLine} fill="none" stroke="var(--loss)" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1={PAD_X} x2={W - PAD_X} y1={ddTop} y2={ddTop} stroke="var(--border-strong)" />
        {point ? <circle cx={x(point.t)} cy={yd(point.drawdown)} r={4} fill="var(--loss)" stroke="var(--text)" strokeWidth="1.5" /> : null}

        <text x={PAD_X} y={total - 4} className={charts.axisLabel}>{formatShortDate(t0)}</text>
        <text x={W - PAD_X} y={total - 4} textAnchor="end" className={charts.axisLabel}>{formatShortDate(t1)}</text>
      </svg>

      {point ? (
        <>
          <div className={styles.crosshair} style={{ left: `${left}%`, bottom: `${(labels / total) * 100}%` }} aria-hidden="true" />
          <div
            className={styles.tip}
            style={{ left: `${left}%`, top: `${top}%` }}
            data-side={left > 70 ? "left" : left < 30 ? "right" : "center"}
            data-v={top < 35 ? "below" : "above"}
            aria-hidden="true"
          >
            <span className={styles.tipDate}>{formatDateTime(point.t)}</span>
            <span className={styles.tipRow}>
              <span>{point.coin}</span>
              <b className={`num ${point.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(point.pnl, { signed: true })}</b>
            </span>
            <span className={styles.tipRow}>
              <span>Running total</span>
              <b className={`num ${styles.plain}`}>{formatUsd(point.v, { signed: true })}</b>
            </span>
            <span className={styles.tipRow}>
              <span>Drawdown</span>
              <b className={`num ${point.drawdown < 0 ? "neg" : "pos"}`}>{point.drawdown < 0 ? formatUsd(point.drawdown) : "New high"}</b>
            </span>
          </div>
        </>
      ) : null}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
