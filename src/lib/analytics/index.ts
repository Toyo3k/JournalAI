import { analyseHolding, holdingInsights } from "./holding";
import { generateInsights } from "./insights";
import { byAsset, byHour, bySide, byWeekday, summarise } from "./metrics";
import { analyseRisk, riskInsights } from "./risk";
import { analyseStocks, stockInsights } from "./stocks";
import type { StockRegistry } from "./stocks";
import { buildEquity, buildTrades } from "./trades";
import type { Capabilities, Fill, Insight, Subject, WalletReport } from "./types";

export type { WalletReport } from "./types";

interface BuildOptions {
  subject: Subject;
  source: WalletReport["source"];
  fills: Fill[];
  capabilities: Capabilities;
  truncated?: boolean;
  notes?: string[];
  /** Insights from outside the fills, such as journal notes, shown ahead of the computed ones. */
  extraInsights?: Insight[];
  /** Robinhood stock tokens, for context. Omit when it cannot be known which assets are stocks. */
  stocks?: { registry: StockRegistry | null; match: "address" | "symbol" };
}

const RECENT_TRADE_COUNT = 12;

export function buildReport({ subject, source, fills, capabilities, truncated = false, notes = [], extraInsights = [], stocks }: BuildOptions): WalletReport {
  const ordered = [...fills].sort((a, b) => a.time - b.time);
  const trades = buildTrades(ordered);
  const summary = summarise(ordered, trades);
  const assets = byAsset(ordered, trades);
  const sides = bySide(trades);
  const hours = byHour(trades);

  const holding = analyseHolding(trades);
  const risk = analyseRisk(ordered, trades, summary, assets, hours);
  const stockContext = stocks ? analyseStocks(trades, stocks.registry, stocks.match) : null;

  return {
    subject,
    source,
    capabilities,
    notes,
    generatedAt: Date.now(),
    truncated,
    summary,
    equity: buildEquity(ordered),
    assets,
    sides,
    hours,
    weekdays: byWeekday(trades),
    recentTrades: trades.slice(-RECENT_TRADE_COUNT).reverse(),
    insights: [
      ...extraInsights,
      ...generateInsights({ summary, trades, assets, sides, hours, capabilities }),
      ...holdingInsights(holding),
      ...stockInsights(stockContext),
      ...riskInsights(risk, summary),
    ],
    holding,
    risk,
    stocks: stockContext,
  };
}
