import { generateInsights } from "./insights";
import { byAsset, byHour, bySide, byWeekday, summarise } from "./metrics";
import { buildEquity, buildTrades } from "./trades";
import type { AccountSnapshot, Fill, WalletReport } from "./types";

export type { WalletReport } from "./types";

interface BuildOptions {
  address: string;
  source: WalletReport["source"];
  fills: Fill[];
  truncated?: boolean;
  account?: AccountSnapshot | null;
}

const RECENT_TRADE_COUNT = 12;

export function buildReport({ address, source, fills, truncated = false, account = null }: BuildOptions): WalletReport {
  const ordered = [...fills].sort((a, b) => a.time - b.time);
  const trades = buildTrades(ordered);
  const summary = summarise(ordered, trades);
  const assets = byAsset(ordered, trades);
  const sides = bySide(trades);
  const hours = byHour(trades);

  return {
    address,
    source,
    generatedAt: Date.now(),
    truncated,
    account,
    summary,
    equity: buildEquity(ordered),
    assets,
    sides,
    hours,
    weekdays: byWeekday(trades),
    recentTrades: trades.slice(-RECENT_TRADE_COUNT).reverse(),
    insights: generateInsights({ summary, trades, assets, sides, hours }),
  };
}
