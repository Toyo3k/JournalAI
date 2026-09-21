import { formatDuration, formatPercent, formatUsd } from "../format";
import type { Bucket, ClosedTrade, HoldingStats, Insight } from "./types";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Upper edge of each holding-period bucket, in milliseconds. The last bucket is open ended. */
const EDGES = [HOUR, 4 * HOUR, DAY, 3 * DAY, 7 * DAY];
const LABELS = ["Under 1h", "1 to 4h", "4 to 24h", "1 to 3d", "3 to 7d", "Over 7d"];

const MIN_TRADES = 5;

const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

interface Held {
  trade: ClosedTrade;
  ms: number;
}

function heldTrades(trades: ClosedTrade[]): Held[] {
  return trades
    .filter((trade) => trade.openedAt !== undefined)
    .map((trade) => ({ trade, ms: Math.max(0, trade.closedAt - (trade.openedAt as number)) }));
}

/** How long positions were held, and how that lines up with results. Null when open times are not recorded. */
export function analyseHolding(trades: ClosedTrade[]): HoldingStats | null {
  const held = heldTrades(trades);
  if (held.length < MIN_TRADES) return null;

  const winners = held.filter(({ trade }) => trade.pnl > 0).map(({ ms }) => ms);
  const losers = held.filter(({ trade }) => trade.pnl < 0).map(({ ms }) => ms);
  const all = held.map(({ ms }) => ms);

  const buckets: Bucket[] = LABELS.map((label, key) => ({ key: String(key), label, trades: 0, pnl: 0, wins: 0 }));
  for (const { trade, ms } of held) {
    const index = EDGES.findIndex((edge) => ms < edge);
    const bucket = buckets[index === -1 ? EDGES.length : index];
    bucket.trades += 1;
    bucket.pnl += trade.pnl;
    if (trade.pnl > 0) bucket.wins += 1;
  }

  return {
    trades: held.length,
    avgMs: average(all),
    medianMs: median(all),
    // A comparison needs a few of each, or one odd trade decides it.
    winnersAvgMs: winners.length >= 3 ? average(winners) : null,
    losersAvgMs: losers.length >= 3 ? average(losers) : null,
    buckets,
  };
}

export function holdingInsights(holding: HoldingStats | null): Insight[] {
  if (!holding) return [];
  const insights: Insight[] = [];

  const { winnersAvgMs: win, losersAvgMs: lose } = holding;
  if (win !== null && lose !== null && win > MINUTE) {
    const ratio = lose / win;
    if (ratio >= 1.5) {
      insights.push({
        id: "hold-losers",
        tone: "caution",
        title: "You hold losers longer than winners",
        stat: `${ratio.toFixed(1)}x`,
        body: `Losing trades were held for ${formatDuration(lose)} on average, against ${formatDuration(win)} for winners. Selling winners early while waiting for losers to recover is the classic disposition effect, and it shrinks your average win relative to your average loss.`,
      });
    } else if (ratio <= 0.67) {
      insights.push({
        id: "hold-winners",
        tone: "positive",
        title: "You let winners run",
        stat: `${(1 / ratio).toFixed(1)}x`,
        body: `Winning trades were held for ${formatDuration(win)} on average, against ${formatDuration(lose)} for losers. Cutting losses faster than you take profits is the habit that protects a small edge.`,
      });
    }
  }

  // Quick flips and the best holding window, each judged only with enough trades in the bucket.
  const flips = holding.buckets[0];
  if (flips.trades >= 8 && flips.pnl < 0) {
    insights.push({
      id: "hold-flips",
      tone: "caution",
      title: "Quick flips are costing you",
      stat: formatUsd(flips.pnl, { signed: true, compact: true }),
      body: `${flips.trades} trades were closed within an hour and lost ${formatUsd(Math.abs(flips.pnl))} in total, winning ${formatPercent(flips.wins / flips.trades, 0)} of the time. Each swap also pays gas, so very short holds have a high bar to clear.`,
    });
  } else {
    const sweet = holding.buckets
      .filter((bucket) => bucket.trades >= 8)
      .sort((a, b) => b.pnl / b.trades - a.pnl / a.trades)[0];
    if (sweet && sweet.pnl > 0 && holding.buckets.filter((bucket) => bucket.trades >= 8).length >= 2) {
      insights.push({
        id: "hold-sweet-spot",
        tone: "positive",
        title: `Your sweet spot is ${sweet.label.toLowerCase()}`,
        stat: formatUsd(sweet.pnl / sweet.trades, { signed: true }),
        body: `Trades held ${sweet.label.toLowerCase()} averaged ${formatUsd(sweet.pnl / sweet.trades, { signed: true })} over ${sweet.trades} trades, the best of your holding periods.`,
      });
    }
  }

  return insights;
}
