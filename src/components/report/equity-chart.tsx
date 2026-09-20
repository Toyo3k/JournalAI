"use client";

import { useId, useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { EquityPoint } from "@/lib/analytics/types";
import { formatDate, formatShortDate, formatUsd } from "@/lib/format";
import styles from "./report.module.css";

const WIDTH = 900;
const HEIGHT = 300;
const PAD_Y = 24;

interface EquityChartProps {
  points: EquityPoint[];
  height?: number;
}

export function EquityChart({ points, height = 300 }: EquityChartProps) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((point) => point.v);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const x = (index: number) => (index / (points.length - 1)) * WIDTH;
    const y = (value: number) => PAD_Y + (1 - (value - min) / span) * (HEIGHT - PAD_Y * 2);

    const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
    const area = `${line} L${WIDTH} ${y(0).toFixed(1)} L0 ${y(0).toFixed(1)} Z`;
    return { min, max, x, y, line, area, zeroY: y(0) };
  }, [points]);

  if (!geometry) {
    return <div className={styles.chartEmpty}>Not enough activity to draw a curve yet.</div>;
  }

  const final = points[points.length - 1].v;
  const tone = final >= 0 ? "var(--gain)" : "var(--loss)";
  const current = active === null ? null : points[active];

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (points.length - 1)));
  }

  const activeX = current && active !== null ? (active / (points.length - 1)) * 100 : 0;
  const activeY = current && geometry ? (geometry.y(current.v) / HEIGHT) * 100 : 0;

  return (
    <div className={styles.chart}>
      <div
        className={styles.chartPlot}
        style={{ height }}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        role="img"
        aria-label={`Cumulative realized profit and loss from ${formatDate(points[0].t)} to ${formatDate(
          points[points.length - 1].t,
        )}, ending at ${formatUsd(final, { signed: true })}.`}
      >
        <div className={styles.chartYAxis} aria-hidden="true">
          <span className="num">{formatUsd(geometry.max, { compact: true })}</span>
          <span className="num">{formatUsd(geometry.min, { compact: true })}</span>
        </div>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className={styles.chartSvg} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" x2={WIDTH} y1={geometry.zeroY} y2={geometry.zeroY} stroke="var(--border-strong)" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path d={geometry.line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {current ? (
          <>
            <div className={styles.crosshair} style={{ left: `${activeX}%` }} />
            <div className={styles.marker} style={{ left: `${activeX}%`, top: `${activeY}%`, background: tone }} />
            <div className={styles.tooltip} style={{ left: `${activeX}%` }} data-flip={activeX > 68 ? "left" : undefined}>
              <span>{formatDate(current.t)}</span>
              <strong className={`num ${current.v >= 0 ? "pos" : "neg"}`}>{formatUsd(current.v, { signed: true })}</strong>
            </div>
          </>
        ) : null}
      </div>
      <div className={styles.chartXAxis} aria-hidden="true">
        <span>{formatShortDate(points[0].t)}</span>
        <span>{formatShortDate(points[points.length - 1].t)}</span>
      </div>
    </div>
  );
}
