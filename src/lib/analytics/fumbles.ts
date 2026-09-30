import type { Fill } from "./types";

/**
 * Fumbles: what the tokens you sold did afterwards. For each sale we compare the price you got
 * with the highest price after it ("left on the table") and with today's price. A sale before a
 * fall is a good exit. All of it is hindsight, so the report frames it that way.
 */

export interface Sale {
  /** Chain-qualified token id, so the same address on two chains never merges. */
  key: string;
  assetId: string;
  coin: string;
  time: number;
  /** Tokens sold. */
  size: number;
  /** USD per token received. */
  price: number;
}

export interface PricePoint {
  t: number;
  high: number;
  close: number;
}

export interface PriceHistory {
  /** Oldest first. */
  candles: PricePoint[];
  current: number;
}

export interface TokenFumble {
  key: string;
  coin: string;
  sales: number;
  soldUsd: number;
  /** Size-weighted average price you sold at. */
  avgSellPrice: number;
  /** The highest price after your first sale. */
  peakPrice: number;
  peakAt: number;
  currentPrice: number;
  /** Extra you'd have got selling each sale at the best price that came after it. Never negative. */
  leftAtPeak: number;
  /** What the tokens you sold are worth today minus what you got. Negative means you got out well. */
  vsToday: number;
  /** Closing prices from the first sale to now, thinned for a sparkline. */
  path: { t: number; price: number }[];
}

export interface FumbleReport {
  /** Tokens whose price history was checked. */
  checked: number;
  /** Tokens sold but not checked: beyond the cap, or no price data. */
  unchecked: number;
  soldUsd: number;
  leftAtPeak: number;
  vsToday: number;
  /** Most money left on the table first. Only tokens that went higher after you sold. */
  fumbles: TokenFumble[];
  /** Biggest saves first. Only tokens worth less today than when you sold. */
  goodExits: TokenFumble[];
  asOf: number;
}

const PATH_POINTS = 48;

/** Sales of priced tokens from a set of fills: closing fills with a token address and a size. */
export function salesFrom(fills: Fill[], chainKey: string): Sale[] {
  return fills
    .filter((fill) => /^close/i.test(fill.dir) && fill.assetId && fill.assetId !== "native" && fill.size > 0 && fill.price > 0)
    .map((fill) => ({ key: `${chainKey}:${fill.assetId}`, assetId: fill.assetId!, coin: fill.coin, time: fill.time, size: fill.size, price: fill.price }));
}

/** The tokens worth checking: the biggest by value sold, up to `limit`. */
export function pickTokens(sales: Sale[], limit: number): { keys: string[]; unchecked: number } {
  const byToken = new Map<string, number>();
  for (const sale of sales) byToken.set(sale.key, (byToken.get(sale.key) ?? 0) + sale.size * sale.price);
  const ranked = [...byToken.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  return { keys: ranked.slice(0, limit), unchecked: Math.max(0, ranked.length - limit) };
}

function thin(points: { t: number; price: number }[], max = PATH_POINTS) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/**
 * Only candles that start at or after the sale count toward its peak, so a high earlier in the
 * same hour (or day) is never counted against you. With no later candle, today's price stands in.
 */
function peakAfter(history: PriceHistory, time: number, asOf: number): { price: number; at: number } {
  let best = { price: history.current, at: asOf };
  for (const candle of history.candles) {
    if (candle.t >= time && candle.high > best.price) best = { price: candle.high, at: candle.t };
  }
  return best;
}

export function analyseFumbles(sales: Sale[], histories: Map<string, PriceHistory>, unchecked = 0, asOf = Date.now()): FumbleReport {
  const byToken = new Map<string, Sale[]>();
  for (const sale of sales) {
    if (!histories.has(sale.key)) continue;
    byToken.set(sale.key, [...(byToken.get(sale.key) ?? []), sale]);
  }

  const tokens: TokenFumble[] = [];
  for (const [key, tokenSales] of byToken) {
    const history = histories.get(key)!;
    const ordered = [...tokenSales].sort((a, b) => a.time - b.time);
    let soldUsd = 0;
    let soldSize = 0;
    let leftAtPeak = 0;
    let vsToday = 0;
    for (const sale of ordered) {
      const peak = peakAfter(history, sale.time, asOf);
      soldUsd += sale.size * sale.price;
      soldSize += sale.size;
      leftAtPeak += Math.max(0, sale.size * (peak.price - sale.price));
      vsToday += sale.size * (history.current - sale.price);
    }
    const overall = peakAfter(history, ordered[0].time, asOf);
    const path = history.candles.filter((candle) => candle.t >= ordered[0].time).map((candle) => ({ t: candle.t, price: candle.close }));
    path.push({ t: asOf, price: history.current });

    tokens.push({
      key,
      coin: ordered[0].coin,
      sales: ordered.length,
      soldUsd,
      avgSellPrice: soldUsd / soldSize,
      peakPrice: overall.price,
      peakAt: overall.at,
      currentPrice: history.current,
      leftAtPeak,
      vsToday,
      path: thin(path),
    });
  }

  const sum = (pick: (token: TokenFumble) => number) => tokens.reduce((total, token) => total + pick(token), 0);
  return {
    checked: tokens.length,
    unchecked: unchecked + (new Set(sales.map((sale) => sale.key)).size - byToken.size),
    soldUsd: sum((token) => token.soldUsd),
    leftAtPeak: sum((token) => token.leftAtPeak),
    vsToday: sum((token) => token.vsToday),
    // Under a cent is rounding, not a fumble.
    fumbles: tokens.filter((token) => token.leftAtPeak >= 0.01).sort((a, b) => b.leftAtPeak - a.leftAtPeak),
    goodExits: tokens.filter((token) => token.vsToday <= -0.01).sort((a, b) => a.vsToday - b.vsToday),
    asOf,
  };
}
