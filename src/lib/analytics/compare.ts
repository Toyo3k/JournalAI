import { formatPercent, formatUsd } from "../format";
import type { AssetStat, WalletReport } from "./types";

export type MetricFormat = "usd" | "usdSigned" | "percent" | "percentFine" | "ratio" | "count" | "duration";
export type Winner = "a" | "b" | "tie";

export interface MetricRow {
  key: string;
  label: string;
  format: MetricFormat;
  a: number | null;
  b: number | null;
  /** Which direction is better, or null when the metric is descriptive rather than a score. */
  better: "higher" | "lower" | null;
  /** Null when the metric is descriptive or either side has no value. */
  winner: Winner | null;
  hint?: string;
}

export interface SharedMarket {
  coin: string;
  a: AssetStat;
  b: AssetStat;
}

export interface Comparison {
  rows: MetricRow[];
  verdict: string[];
  shared: SharedMarket[];
  /** Either wallet has too few trades for a comparison to mean much. */
  smallSample: boolean;
}

const MIN_TRADES = 20;
/** Values closer than this, relative to the larger one, are called a tie. */
const TIE_TOLERANCE = 0.01;

/** A profit factor or payoff ratio with no losses is unbounded, which should beat any finite number. */
function unbounded(value: number | null, hasWins: boolean, hasLosses: boolean): number | null {
  if (value !== null) return value;
  return hasWins && !hasLosses ? Number.POSITIVE_INFINITY : null;
}

function decide(a: number | null, b: number | null, better: MetricRow["better"]): Winner | null {
  if (better === null || a === null || b === null) return null;
  if (a === b) return "tie";
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (Number.isFinite(scale) && Math.abs(a - b) / scale < TIE_TOLERANCE) return "tie";
  const aWins = better === "higher" ? a > b : a < b;
  return aWins ? "a" : "b";
}

function row(key: string, label: string, format: MetricFormat, a: number | null, b: number | null, better: MetricRow["better"], hint?: string): MetricRow {
  return { key, label, format, a, b, better, winner: decide(a, b, better), hint };
}

const perDollar = (report: WalletReport) => (report.summary.volume > 0 ? report.summary.netPnl / report.summary.volume : null);

export function sharedMarkets(a: WalletReport, b: WalletReport): SharedMarket[] {
  const other = new Map(b.assets.filter((asset) => asset.trades > 0).map((asset) => [asset.coin, asset]));
  return a.assets
    .filter((asset) => asset.trades > 0 && other.has(asset.coin))
    .map((asset) => ({ coin: asset.coin, a: asset, b: other.get(asset.coin)! }))
    .sort((x, y) => y.a.volume + y.b.volume - (x.a.volume + x.b.volume));
}

export function metricRows(a: WalletReport, b: WalletReport): MetricRow[] {
  const x = a.summary;
  const y = b.summary;
  const feesKnown = a.capabilities.fees && b.capabilities.fees;

  return [
    row("netPnl", "Net realized P&L", "usdSigned", x.netPnl, y.netPnl, "higher", "Closed P&L after fees. Favours the larger wallet."),
    row("perDollar", "Net P&L per $ traded", "percentFine", perDollar(a), perDollar(b), "higher", "Net P&L divided by volume, so wallets of different sizes compare fairly."),
    row("winRate", "Win rate", "percent", x.winRate, y.winRate, "higher"),
    row(
      "profitFactor",
      "Profit factor",
      "ratio",
      unbounded(x.profitFactor, x.wins > 0, x.losses > 0),
      unbounded(y.profitFactor, y.wins > 0, y.losses > 0),
      "higher",
      "Gross profit divided by gross loss.",
    ),
    row(
      "payoff",
      "Avg win vs avg loss",
      "ratio",
      unbounded(x.payoffRatio, x.wins > 0, x.losses > 0),
      unbounded(y.payoffRatio, y.wins > 0, y.losses > 0),
      "higher",
      "How much bigger the average winner is than the average loser.",
    ),
    row("expectancy", "Expectancy per trade", "usdSigned", x.expectancy, y.expectancy, "higher"),
    row("sharpe", "Sharpe-like ratio", "ratio", a.risk?.sharpe ?? null, b.risk?.sharpe ?? null, "higher", "Daily P&L divided by how much it swings, annualised. Needs two weeks of history."),
    row("drawdown", "Max drawdown", "usd", x.maxDrawdown, y.maxDrawdown, "lower", "Largest peak to trough fall in realized P&L."),
    row("recovery", "Recovery factor", "ratio", a.risk?.recoveryFactor ?? null, b.risk?.recoveryFactor ?? null, "higher", "Net P&L divided by max drawdown."),
    row("fees", "Fees paid", "usd", feesKnown ? x.fees : null, feesKnown ? y.fees : null, "lower"),
    row("lossStreak", "Longest losing streak", "count", x.longestLossStreak, y.longestLossStreak, "lower"),
    row("winStreak", "Longest winning streak", "count", x.longestWinStreak, y.longestWinStreak, "higher"),
    row("hold", "Average hold time", "duration", a.holding?.avgMs ?? null, b.holding?.avgMs ?? null, null, "How long positions were held before closing, where the open time is known."),
    row("trades", "Closed trades", "count", x.tradeCount, y.tradeCount, null),
    row("days", "Active days", "count", x.activeDays, y.activeDays, null),
    row("volume", "Trading volume", "usd", x.volume, y.volume, null),
  ];
}

/**
 * Plain-language differences between two wallets. Each line is only produced
 * when the data backs it up, and the lines are ordered by how much they tell you.
 */
export function compareVerdict(a: WalletReport, b: WalletReport, rows: MetricRow[], labelA: string, labelB: string): string[] {
  const get = (key: string) => rows.find((entry) => entry.key === key)!;
  const name = (winner: Winner) => (winner === "a" ? labelA : labelB);
  const other = (winner: Winner) => (winner === "a" ? labelB : labelA);
  const lines: string[] = [];

  const pnl = get("netPnl");
  const size = get("perDollar");
  if (pnl.winner && pnl.winner !== "tie" && pnl.a !== null && pnl.b !== null) {
    const lead = Math.abs(pnl.a - pnl.b);
    if (size.winner && size.winner !== "tie" && size.winner !== pnl.winner && size.a !== null && size.b !== null) {
      lines.push(
        `${name(pnl.winner)} made more in total (${formatUsd(lead)} ahead), but ${name(size.winner)} earned more for every dollar traded (${formatPercent(size.winner === "a" ? size.a : size.b, 2)} vs ${formatPercent(size.winner === "a" ? size.b : size.a, 2)}). ${name(pnl.winner)} simply traded more capital.`,
      );
    } else {
      lines.push(`${name(pnl.winner)} is ahead by ${formatUsd(lead)} in net P&L${size.winner === pnl.winner ? ", and the gap holds after adjusting for how much each traded" : ""}.`);
    }
  }

  const win = get("winRate");
  const payoff = get("payoff");
  if (win.winner && win.winner !== "tie" && payoff.winner && payoff.winner !== "tie" && win.winner !== payoff.winner && win.a !== null && win.b !== null) {
    const fmt = (value: number | null) => (value === null ? "n/a" : Number.isFinite(value) ? `${value.toFixed(1)}x` : "unbounded");
    lines.push(
      `${name(win.winner)} wins more often (${formatPercent(Math.max(win.a, win.b), 0)} vs ${formatPercent(Math.min(win.a, win.b), 0)}), but ${name(payoff.winner)}'s winners are bigger relative to its losers (${fmt(payoff.winner === "a" ? payoff.a : payoff.b)} vs ${fmt(payoff.winner === "a" ? payoff.b : payoff.a)}). Two different ways of making money.`,
    );
  }

  const draw = get("drawdown");
  if (a.summary.netPnl > 0 && b.summary.netPnl > 0 && draw.a !== null && draw.b !== null && draw.winner && draw.winner !== "tie") {
    const ratioA = a.summary.maxDrawdown / a.summary.netPnl;
    const ratioB = b.summary.maxDrawdown / b.summary.netPnl;
    if (Math.abs(ratioA - ratioB) > 0.1) {
      const safer = ratioA < ratioB ? "a" : "b";
      lines.push(
        `${name(safer)} kept its worst drawdown to ${formatPercent(Math.min(ratioA, ratioB), 0)} of its total profit, against ${formatPercent(Math.max(ratioA, ratioB), 0)} for ${other(safer)}. That is the smoother ride.`,
      );
    }
  }

  const trades = get("trades");
  if (trades.a && trades.b) {
    const busier = trades.a >= trades.b ? "a" : "b";
    const ratio = Math.max(trades.a, trades.b) / Math.min(trades.a, trades.b);
    if (ratio >= 1.5) lines.push(`${name(busier)} trades ${ratio.toFixed(1)}x as often as ${other(busier)} (${Math.max(trades.a, trades.b)} vs ${Math.min(trades.a, trades.b)} closed trades).`);
  }

  const shared = sharedMarkets(a, b).filter((market) => market.a.trades >= 3 && market.b.trades >= 3);
  if (shared.length >= 2) {
    const aLeads = shared.filter((market) => market.a.pnl > market.b.pnl).length;
    const bLeads = shared.length - aLeads;
    if (aLeads !== bLeads) {
      const leader = aLeads > bLeads ? "a" : "b";
      lines.push(`Across the ${shared.length} markets both trade, ${name(leader)} does better in ${Math.max(aLeads, bLeads)} and ${other(leader)} in ${Math.min(aLeads, bLeads)}.`);
    }
  }

  return lines.slice(0, 5);
}

export function compareReports(a: WalletReport, b: WalletReport, labelA: string, labelB: string): Comparison {
  const rows = metricRows(a, b);
  return {
    rows,
    verdict: compareVerdict(a, b, rows, labelA, labelB),
    shared: sharedMarkets(a, b),
    smallSample: a.summary.tradeCount < MIN_TRADES || b.summary.tradeCount < MIN_TRADES,
  };
}
