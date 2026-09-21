"use client";

import { useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { EquityPoint } from "@/lib/analytics/types";
import { formatDate, formatShortDate, formatUsd } from "@/lib/format";
import report from "@/components/report/report.module.css";
import styles from "./compare.module.css";

const WIDTH = 900;
const HEIGHT = 320;
const PAD_Y = 24;

export interface Series {
  label: string;
  color: string;
  points: EquityPoint[];
}

/** Equity is a running total that holds its value between trades, so look up the last point at or before a time. */
function valueAt(points: EquityPoint[], time: number): number | null {
  if (!points.length || time < points[0].t) return null;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (points[mid].t <= time) low = mid;
    else high = mid - 1;
  }
  return points[low].v;
}

export function CompareChart({ series }: { series: Series[] }) {
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const all = series.flatMap((entry) => entry.points);
    if (all.length < 2) return null;
    const start = Math.min(...all.map((point) => point.t));
    const end = Math.max(...all.map((point) => point.t));
    const values = all.map((point) => point.v);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const range = end - start || 1;
    const x = (time: number) => ((time - start) / range) * WIDTH;
    const y = (value: number) => PAD_Y + (1 - (value - min) / span) * (HEIGHT - PAD_Y * 2);
    const lines = series.map((entry) => entry.points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" "));
    return { start, end, min, max, x, y, lines, zeroY: y(0) };
  }, [series]);

  if (!geometry) return <div className={report.chartEmpty}>Not enough activity to draw the curves yet.</div>;

  const time = active === null ? null : geometry.start + active * (geometry.end - geometry.start);
  const activeX = active === null ? 0 : active * 100;

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
  }

  const summary = series
    .map((entry) => `${entry.label} ends at ${formatUsd(entry.points[entry.points.length - 1]?.v ?? 0, { signed: true })}`)
    .join(". ");

  return (
    <div className={styles.chartWrap}>
      <div className={styles.legend}>
        {series.map((entry) => (
          <span key={entry.label} className={styles.legendItem}>
            <i style={{ background: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>
      <div className={styles.plot} onPointerMove={onMove} onPointerLeave={() => setActive(null)} role="img" aria-label={`Cumulative realized profit and loss for both wallets. ${summary}.`}>
        <div className={report.chartYAxis} aria-hidden="true">
          <span className="num">{formatUsd(geometry.max, { compact: true })}</span>
          <span className="num">{formatUsd(geometry.min, { compact: true })}</span>
        </div>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className={report.chartSvg} aria-hidden="true">
          <line x1="0" x2={WIDTH} y1={geometry.zeroY} y2={geometry.zeroY} stroke="var(--border-strong)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          {series.map((entry, index) => (
            <path key={entry.label} d={geometry.lines[index]} fill="none" stroke={entry.color} strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {time !== null ? (
          <>
            <div className={report.crosshair} style={{ left: `${activeX}%` }} />
            {series.map((entry) => {
              const value = valueAt(entry.points, time);
              return value === null ? null : (
                <div key={entry.label} className={report.marker} style={{ left: `${activeX}%`, top: `${(geometry.y(value) / HEIGHT) * 100}%`, background: entry.color }} />
              );
            })}
            <div className={report.tooltip} style={{ left: `${activeX}%` }} data-flip={activeX > 65 ? "left" : undefined}>
              <span>{formatDate(time)}</span>
              {series.map((entry) => {
                const value = valueAt(entry.points, time);
                return (
                  <strong key={entry.label} className={`num ${styles.tipRow}`}>
                    <i style={{ background: entry.color }} />
                    {value === null ? "not started" : <span className={value >= 0 ? "pos" : "neg"}>{formatUsd(value, { signed: true })}</span>}
                  </strong>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      <div className={report.chartXAxis} aria-hidden="true">
        <span>{formatShortDate(geometry.start)}</span>
        <span>{formatShortDate(geometry.end)}</span>
      </div>
    </div>
  );
}
