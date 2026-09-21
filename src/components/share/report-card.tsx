import type { WalletReport } from "@/lib/analytics/types";
import { formatDate, formatPercent, formatRatio, formatUsd, pluralise } from "@/lib/format";

/**
 * The 1200x630 share card, rendered by `next/og`. That renderer supports only
 * a subset of CSS (flexbox, inline styles), so this is deliberately plain and
 * every container with more than one child sets display: flex.
 */
export const CARD_SIZE = { width: 1200, height: 630 };

const COLORS = {
  bg: "#08090c",
  surface: "#0e1015",
  border: "#252a36",
  text: "#eceef3",
  muted: "#868da0",
  dim: "#5a6072",
  accent: "#a3adff",
  gain: "#38d39f",
  loss: "#f47174",
};

const BASE = { display: "flex", fontFamily: "sans-serif" } as const;

function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="7" fill="#8592ff" fillOpacity="0.2" />
      <path d="M5 16.5 9.5 11l3.2 3.2L19 7.5" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brand() {
  return (
    <div style={{ ...BASE, alignItems: "center", gap: 12 }}>
      <Mark />
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: COLORS.text }}>
        Journal<span style={{ color: COLORS.accent }}>AI</span>
      </div>
    </div>
  );
}

function Sparkline({ points, color }: { points: WalletReport["equity"]; color: string }) {
  const width = 1104;
  const height = 150;
  if (points.length < 2) return <div style={{ display: "flex", height }} />;

  const values = points.map((point) => point.v);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const first = points[0].t;
  const range = points[points.length - 1].t - first || 1;
  const x = (t: number) => ((t - first) / range) * width;
  const y = (v: number) => 8 + (1 - (v - min) / span) * (height - 16);

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)} ${y(point.v).toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${y(0).toFixed(1)} L0 ${y(0).toFixed(1)} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke={COLORS.border} strokeDasharray="6 6" />
      <path d={area} fill="url(#fill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...BASE, flexDirection: "column", gap: 4, flex: 1 }}>
      <div style={{ display: "flex", fontSize: 20, color: COLORS.muted }}>{label}</div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: COLORS.text }}>{value}</div>
    </div>
  );
}

export function ReportCard({ report }: { report: WalletReport }) {
  const { summary } = report;
  const positive = summary.netPnl >= 0;
  const tone = positive ? COLORS.gain : COLORS.loss;
  const badge = report.source === "demo" ? "Sample data" : "Robinhood Chain";

  return (
    <div
      style={{
        ...BASE,
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 48,
        background: `radial-gradient(90% 70% at 15% 0%, rgba(133,146,255,0.16), ${COLORS.bg} 70%)`,
        color: COLORS.text,
      }}
    >
      <div style={{ ...BASE, justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        <div style={{ display: "flex", padding: "8px 18px", borderRadius: 999, border: `1px solid ${COLORS.border}`, background: COLORS.surface, fontSize: 22, color: COLORS.muted }}>
          {badge}
        </div>
      </div>

      <div style={{ ...BASE, flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", fontSize: 30, color: COLORS.muted }}>
          {report.subject.label}
          {summary.tradeCount ? `  ·  ${pluralise(summary.tradeCount, "trade")}, ${formatDate(summary.firstFillAt)} to ${formatDate(summary.lastFillAt)}` : ""}
        </div>
        <div style={{ display: "flex", fontSize: 116, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3, color: tone }}>
          {formatUsd(summary.netPnl, { signed: true })}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: COLORS.dim }}>Net realized P&amp;L after gas</div>
      </div>

      <div style={{ ...BASE, flexDirection: "column", gap: 20 }}>
        <Sparkline points={report.equity} color={tone} />
        <div style={{ ...BASE, gap: 24 }}>
          <Stat label="Win rate" value={formatPercent(summary.winRate, 0)} />
          <Stat label="Profit factor" value={formatRatio(summary.profitFactor)} />
          <Stat label="Expectancy" value={formatUsd(summary.expectancy, { signed: true })} />
          <Stat label="Max drawdown" value={formatUsd(-summary.maxDrawdown, { compact: true })} />
        </div>
      </div>
    </div>
  );
}

/** Used when there is no report to show, such as the home page or a wallet that could not be loaded. */
export function BrandCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        ...BASE,
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: `radial-gradient(90% 80% at 20% 0%, rgba(133,146,255,0.2), ${COLORS.bg} 70%)`,
      }}
    >
      <Brand />
      <div style={{ ...BASE, flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 84, lineHeight: 1.05, fontWeight: 800, letterSpacing: -2.5, color: COLORS.text }}>{title}</div>
        <div style={{ display: "flex", fontSize: 32, color: COLORS.muted }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: COLORS.dim }}>Robinhood Chain wallet analytics</div>
    </div>
  );
}
