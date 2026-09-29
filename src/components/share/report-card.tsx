import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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

/** The cropped icon glyph from the NeuroX logo, natural size 170x112 (aspect ~1.52). */
const MARK_ASPECT = 170 / 112;

/**
 * Loaded once per server lifetime and reused across every card render. `logo-mark.png`
 * sits next to this file so bundlers can trace and include it in any deployment target.
 * These routes run on the Node runtime, where `fetch` has no support for `file:` URLs,
 * so the file is read directly instead of following Edge-runtime `fetch(new URL(...))` examples.
 */
let markBytes: Promise<Buffer> | null = null;
export function loadMark(): Promise<Buffer> {
  if (!markBytes) {
    const loaded = readFile(fileURLToPath(new URL("./logo-mark.png", import.meta.url)));
    // A failure here must not be remembered, or one bad load would break every card for the life of the process.
    loaded.catch(() => {
      if (markBytes === loaded) markBytes = null;
    });
    markBytes = loaded;
  }
  return markBytes;
}

function Mark({ src, height = 36 }: { src: Buffer; height?: number }) {
  // next/og's renderer (satori) needs an actual image source string, not raw bytes: a data URI it is.
  const dataUri = `data:image/png;base64,${Buffer.from(src).toString("base64")}`;
  // eslint-disable-next-line @next/next/no-img-element -- rendered by next/og's ImageResponse, not the browser
  return <img src={dataUri} width={Math.round(height * MARK_ASPECT)} height={height} style={{ display: "flex" }} alt="" />;
}

/** `logo` is null when it could not be loaded, so the wordmark still renders on its own rather than the whole card failing. */
function Brand({ logo }: { logo: Buffer | null }) {
  return (
    <div style={{ ...BASE, alignItems: "center", gap: 14 }}>
      {logo ? <Mark src={logo} /> : null}
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: COLORS.text }}>
        Neuro<span style={{ color: COLORS.accent }}>X</span>
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

export function ReportCard({ report, logo }: { report: WalletReport; logo: Buffer | null }) {
  const { summary } = report;
  const positive = summary.netPnl >= 0;
  const tone = positive ? COLORS.gain : COLORS.loss;
  const badge = report.source === "demo" ? "Sample data" : report.source === "solana" ? "Solana" : "Robinhood Chain";

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
        <Brand logo={logo} />
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
export function BrandCard({ title, subtitle, logo }: { title: string; subtitle: string; logo: Buffer | null }) {
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
      <Brand logo={logo} />
      <div style={{ ...BASE, flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 84, lineHeight: 1.05, fontWeight: 800, letterSpacing: -2.5, color: COLORS.text }}>{title}</div>
        <div style={{ display: "flex", fontSize: 32, color: COLORS.muted }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: COLORS.dim }}>On-chain wallet analytics</div>
    </div>
  );
}
