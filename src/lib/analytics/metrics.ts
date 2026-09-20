import type { AssetStat, Bucket, ClosedTrade, Fill, SideStat, Summary } from "./types";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function streaks(trades: ClosedTrade[]) {
  let win = 0;
  let loss = 0;
  let bestWin = 0;
  let bestLoss = 0;
  for (const trade of trades) {
    if (trade.pnl > 0) {
      win += 1;
      loss = 0;
    } else if (trade.pnl < 0) {
      loss += 1;
      win = 0;
    }
    bestWin = Math.max(bestWin, win);
    bestLoss = Math.max(bestLoss, loss);
  }
  return { bestWin, bestLoss };
}

function maxDrawdown(fills: Fill[]): number {
  let running = 0;
  let peak = 0;
  let worst = 0;
  for (const fill of fills) {
    running += fill.closedPnl - fill.fee;
    peak = Math.max(peak, running);
    worst = Math.max(worst, peak - running);
  }
  return worst;
}

export function summarise(fills: Fill[], trades: ClosedTrade[]): Summary {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = sum(wins.map((trade) => trade.pnl));
  const grossLoss = Math.abs(sum(losses.map((trade) => trade.pnl)));
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const decided = wins.length + losses.length;
  const { bestWin, bestLoss } = streaks(trades);

  const days = new Set(fills.map((fill) => Math.floor(fill.time / DAY_MS)));
  const byPnl = [...trades].sort((a, b) => b.pnl - a.pnl);

  return {
    fillCount: fills.length,
    tradeCount: trades.length,
    firstFillAt: fills[0]?.time ?? 0,
    lastFillAt: fills[fills.length - 1]?.time ?? 0,
    activeDays: days.size,
    volume: sum(fills.map((fill) => fill.price * fill.size)),
    fees: sum(fills.map((fill) => fill.fee)),
    netPnl: sum(fills.map((fill) => fill.closedPnl - fill.fee)),
    wins: wins.length,
    losses: losses.length,
    winRate: decided ? wins.length / decided : 0,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: trades.length ? sum(trades.map((trade) => trade.pnl)) / trades.length : 0,
    best: byPnl[0] && byPnl[0].pnl > 0 ? byPnl[0] : null,
    worst: byPnl.length && byPnl[byPnl.length - 1].pnl < 0 ? byPnl[byPnl.length - 1] : null,
    maxDrawdown: maxDrawdown(fills),
    longestWinStreak: bestWin,
    longestLossStreak: bestLoss,
    makerShare: fills.length ? fills.filter((fill) => !fill.crossed).length / fills.length : 0,
  };
}

export function byAsset(fills: Fill[], trades: ClosedTrade[]): AssetStat[] {
  const stats = new Map<string, { trades: number; wins: number; decided: number; pnl: number; volume: number }>();
  const entry = (coin: string) => {
    let value = stats.get(coin);
    if (!value) {
      value = { trades: 0, wins: 0, decided: 0, pnl: 0, volume: 0 };
      stats.set(coin, value);
    }
    return value;
  };

  for (const fill of fills) entry(fill.coin).volume += fill.price * fill.size;
  for (const trade of trades) {
    const value = entry(trade.coin);
    value.trades += 1;
    value.pnl += trade.pnl;
    if (trade.pnl !== 0) value.decided += 1;
    if (trade.pnl > 0) value.wins += 1;
  }

  return [...stats.entries()]
    .map(([coin, value]) => ({
      coin,
      trades: value.trades,
      pnl: value.pnl,
      winRate: value.decided ? value.wins / value.decided : 0,
      volume: value.volume,
    }))
    .sort((a, b) => b.volume - a.volume);
}

export function bySide(trades: ClosedTrade[]): SideStat[] {
  return (["Long", "Short"] as const).map((side) => {
    const own = trades.filter((trade) => trade.side === side);
    const decided = own.filter((trade) => trade.pnl !== 0);
    return {
      side,
      trades: own.length,
      pnl: sum(own.map((trade) => trade.pnl)),
      winRate: decided.length ? decided.filter((trade) => trade.pnl > 0).length / decided.length : 0,
    };
  });
}

function bucketTrades(trades: ClosedTrade[], size: number, keyOf: (date: Date) => number, labelOf: (key: number) => string): Bucket[] {
  const buckets: Bucket[] = Array.from({ length: size }, (_, key) => ({
    key: String(key),
    label: labelOf(key),
    trades: 0,
    pnl: 0,
    wins: 0,
  }));
  for (const trade of trades) {
    const bucket = buckets[keyOf(new Date(trade.closedAt))];
    bucket.trades += 1;
    bucket.pnl += trade.pnl;
    if (trade.pnl > 0) bucket.wins += 1;
  }
  return buckets;
}

/** Hours are in UTC so a report reads the same for every viewer. */
export const byHour = (trades: ClosedTrade[]) =>
  bucketTrades(trades, 24, (date) => date.getUTCHours(), (hour) => String(hour).padStart(2, "0"));

export const byWeekday = (trades: ClosedTrade[]) =>
  bucketTrades(trades, 7, (date) => date.getUTCDay(), (day) => WEEKDAYS[day]);
