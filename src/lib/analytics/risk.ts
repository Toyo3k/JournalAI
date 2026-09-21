import { formatPercent, formatUsd } from "../format";
import type { AssetStat, Bucket, ClosedTrade, Fill, Insight, RiskStats, Summary, WhatIf } from "./types";

const DAY_MS = 86_400_000;
/**
 * Annualising a short or mostly empty daily series produces noise that looks
 * like a score, so both the calendar span and the number of days that actually
 * had activity must clear a bar.
 */
const MIN_DAYS = 14;
const MIN_ACTIVE_DAYS = 8;
const MIN_TRADES = 10;
const MIN_GROUP = 5;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Realized P&L per calendar day between the first and last fill, including days with no activity. */
function dailySeries(fills: Fill[]): { series: number[]; activeDays: number } {
  if (!fills.length) return { series: [], activeDays: 0 };
  const byDay = new Map<number, number>();
  for (const fill of fills) {
    const day = Math.floor(fill.time / DAY_MS);
    byDay.set(day, (byDay.get(day) ?? 0) + fill.closedPnl - fill.fee);
  }
  const days = [...byDay.keys()];
  const first = Math.min(...days);
  const last = Math.max(...days);
  return { series: Array.from({ length: last - first + 1 }, (_, i) => byDay.get(first + i) ?? 0), activeDays: byDay.size };
}

function annualised({ series, activeDays }: { series: number[]; activeDays: number }): { sharpe: number | null; sortino: number | null } {
  if (series.length < MIN_DAYS || activeDays < MIN_ACTIVE_DAYS) return { sharpe: null, sortino: null };

  const mean = sum(series) / series.length;
  const variance = sum(series.map((value) => (value - mean) ** 2)) / (series.length - 1);
  const deviation = Math.sqrt(variance);
  const downside = Math.sqrt(sum(series.map((value) => Math.min(0, value) ** 2)) / series.length);
  const scale = Math.sqrt(365);

  return {
    sharpe: deviation > 0 ? (mean / deviation) * scale : null,
    sortino: downside > 0 ? (mean / downside) * scale : null,
  };
}

/** Time spent below the previous equity peak, judged on the fill-by-fill running total. */
function drawdownTiming(fills: Fill[]): { longestMs: number; underwater: boolean; current: number } {
  let running = 0;
  let peak = 0;
  let peakTime = fills[0]?.time ?? 0;
  let longest = 0;
  let underwaterSince: number | null = null;

  for (const fill of fills) {
    running += fill.closedPnl - fill.fee;
    if (running >= peak) {
      if (underwaterSince !== null) longest = Math.max(longest, fill.time - peakTime);
      peak = running;
      peakTime = fill.time;
      underwaterSince = null;
    } else if (underwaterSince === null) {
      underwaterSince = fill.time;
    }
  }

  const end = fills[fills.length - 1]?.time ?? 0;
  if (underwaterSince !== null) longest = Math.max(longest, end - peakTime);
  return { longestMs: longest, underwater: underwaterSince !== null, current: Math.max(0, peak - running) };
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(fraction * sorted.length)))];
}

function whatIfs(trades: ClosedTrade[], summary: Summary, assets: AssetStat[], hours: Bucket[]): WhatIf[] {
  const scenarios: WhatIf[] = [];

  const worstHour = hours.filter((bucket) => bucket.trades >= MIN_GROUP).sort((a, b) => a.pnl - b.pnl)[0];
  if (worstHour && worstHour.pnl < 0) {
    scenarios.push({
      id: "skip-hour",
      label: `Skip trades closed at ${worstHour.label}:00 UTC`,
      detail: `${worstHour.trades} trades closed in that hour lost ${formatUsd(Math.abs(worstHour.pnl))} in total.`,
      delta: -worstHour.pnl,
      tradesAffected: worstHour.trades,
    });
  }

  const worstAsset = assets.filter((asset) => asset.trades >= MIN_GROUP).sort((a, b) => a.pnl - b.pnl)[0];
  if (worstAsset && worstAsset.pnl < 0) {
    scenarios.push({
      id: "skip-asset",
      label: `Never trade ${worstAsset.coin}`,
      detail: `${worstAsset.trades} trades in ${worstAsset.coin} lost ${formatUsd(Math.abs(worstAsset.pnl))} in total.`,
      delta: -worstAsset.pnl,
      tradesAffected: worstAsset.trades,
    });
  }

  // A cap that assumes every big loss could have been stopped out sooner, which is optimistic, so it is worded as a ceiling.
  if (summary.losses >= MIN_GROUP && summary.avgLoss > 0) {
    const cap = 1.5 * summary.avgLoss;
    const capped = trades.filter((trade) => trade.pnl < -cap);
    const delta = sum(capped.map((trade) => -cap - trade.pnl));
    if (capped.length && delta > 0) {
      scenarios.push({
        id: "cap-losses",
        label: `Cap every loss at ${formatUsd(cap)}`,
        detail: `${capped.length} losses were bigger than 1.5x your average loss. This is the most it could have saved, since a stop is not always filled at the price you set.`,
        delta,
        tradesAffected: capped.length,
      });
    }
  }

  return scenarios.sort((a, b) => b.delta - a.delta);
}

/** Risk measures for a trading record. Returns null when there is too little activity for any of it to mean much. */
export function analyseRisk(fills: Fill[], trades: ClosedTrade[], summary: Summary, assets: AssetStat[], hours: Bucket[]): RiskStats | null {
  if (trades.length < MIN_TRADES) return null;

  const { sharpe, sortino } = annualised(dailySeries(fills));
  const timing = drawdownTiming(fills);

  // Kelly needs both wins and losses, or the payoff ratio is undefined.
  const kelly =
    summary.payoffRatio !== null && summary.wins >= MIN_GROUP && summary.losses >= MIN_GROUP
      ? summary.winRate - (1 - summary.winRate) / summary.payoffRatio
      : null;

  const sorted = trades.map((trade) => trade.pnl).sort((a, b) => a - b);
  const var95 = trades.length >= 20 ? percentile(sorted, 0.05) : null;
  const worst = sorted[0];
  const tailRatio = summary.losses >= MIN_GROUP && summary.avgLoss > 0 && worst < 0 ? Math.abs(worst) / summary.avgLoss : null;

  return {
    sharpe,
    sortino,
    kelly,
    recoveryFactor: summary.maxDrawdown > 0 ? summary.netPnl / summary.maxDrawdown : null,
    longestDrawdownMs: timing.longestMs,
    underwater: timing.underwater,
    currentDrawdown: timing.current,
    var95,
    tailRatio,
    whatIfs: whatIfs(trades, summary, assets, hours),
  };
}

export function riskInsights(risk: RiskStats | null, summary: Summary): Insight[] {
  if (!risk) return [];
  const insights: Insight[] = [];

  if (risk.tailRatio !== null && risk.tailRatio >= 4) {
    insights.push({
      id: "risk-tail",
      tone: "caution",
      title: "One loss dwarfs the rest",
      stat: `${risk.tailRatio.toFixed(1)}x`,
      body: `Your worst loss is ${risk.tailRatio.toFixed(1)} times your average loss. A few outsized losses can erase many small wins, so it is worth having a rule that caps what any single trade can cost.`,
    });
  }

  if (risk.kelly !== null && summary.netPnl > 0) {
    if (risk.kelly > 0) {
      insights.push({
        id: "risk-kelly",
        tone: "neutral",
        title: "Size suggested by your edge",
        stat: formatPercent(risk.kelly / 2, 1),
        body: `On your win rate and payoff, the Kelly formula suggests risking up to ${formatPercent(risk.kelly, 1)} of capital per trade, and traders usually use half of that (${formatPercent(risk.kelly / 2, 1)}). Treat it as a ceiling, since it assumes your past edge continues.`,
      });
    }
  } else if (risk.kelly !== null && risk.kelly <= 0) {
    insights.push({
      id: "risk-kelly",
      tone: "caution",
      title: "Your record shows no sizing edge",
      body: `At your win rate and payoff, the Kelly formula says there is no positive amount worth risking per trade. That is a signal to improve the strategy before adding size.`,
    });
  }

  const best = risk.whatIfs[0];
  if (best && best.delta > 0 && best.tradesAffected >= MIN_GROUP) {
    insights.push({
      id: "risk-what-if",
      tone: "neutral",
      title: best.label,
      stat: formatUsd(best.delta, { signed: true, compact: true }),
      body: `${best.detail} Removing that alone would have moved your net trade P&L by ${formatUsd(best.delta, { signed: true })}. This is hindsight, so use it to find a habit worth fixing rather than a forecast.`,
    });
  }

  return insights.slice(0, 3);
}
