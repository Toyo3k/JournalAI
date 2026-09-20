import type { ClosedTrade, EquityPoint, Fill } from "./types";

const CLOSING_DIR = /^(close|liquidat|auto)/i;

function isClosing(fill: Fill): boolean {
  return CLOSING_DIR.test(fill.dir) || fill.closedPnl !== 0;
}

/**
 * Groups closing fills that belong to the same order into one trade, so a
 * large order that filled in twenty slices counts once, not twenty times.
 */
export function buildTrades(fills: Fill[]): ClosedTrade[] {
  const groups = new Map<string, ClosedTrade>();

  for (const fill of fills) {
    if (!isClosing(fill)) continue;

    const key = `${fill.coin}:${fill.orderId}`;
    const notional = fill.price * fill.size;
    const net = fill.closedPnl - fill.fee;
    const existing = groups.get(key);

    if (existing) {
      existing.pnl += net;
      existing.fees += fill.fee;
      existing.notional += notional;
      existing.closedAt = Math.max(existing.closedAt, fill.time);
      continue;
    }

    // Selling closes a long; buying closes a short. `dir` is the primary
    // signal, the fill direction is the fallback.
    const side = /short/i.test(fill.dir) ? "Short" : /long/i.test(fill.dir) ? "Long" : fill.isBuy ? "Short" : "Long";

    groups.set(key, {
      id: key,
      coin: fill.coin,
      side,
      closedAt: fill.time,
      pnl: net,
      fees: fill.fee,
      notional,
    });
  }

  return [...groups.values()].sort((a, b) => a.closedAt - b.closedAt);
}

const MAX_EQUITY_POINTS = 240;

/** Cumulative realized P&L after every fee, thinned to a chartable size. */
export function buildEquity(fills: Fill[]): EquityPoint[] {
  let running = 0;
  const points: EquityPoint[] = fills.map((fill) => {
    running += fill.closedPnl - fill.fee;
    return { t: fill.time, v: running };
  });

  if (points.length <= MAX_EQUITY_POINTS) return points;

  const step = (points.length - 1) / (MAX_EQUITY_POINTS - 1);
  const thinned: EquityPoint[] = [];
  for (let i = 0; i < MAX_EQUITY_POINTS; i++) {
    thinned.push(points[Math.round(i * step)]);
  }
  return thinned;
}
