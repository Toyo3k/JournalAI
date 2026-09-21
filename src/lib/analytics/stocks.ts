import { formatPercent, formatUsd } from "../format";
import { SESSION_LABELS, SESSION_ORDER, marketSession } from "./sessions";
import type { Session } from "./sessions";
import type { Bucket, ClosedTrade, Insight, StockContext, StockInfo, StockTokenStat } from "./types";

export interface StockRegistry {
  /** Keyed by lowercase contract address. The only trustworthy way to identify a token on chain. */
  byAddress: Map<string, StockInfo>;
  bySymbol: Map<string, StockInfo>;
}

const MIN_GROUP = 5;

/**
 * Identifies which trades were in Robinhood stock tokens. On-chain wallets match
 * by contract address, because anyone can deploy a token with the symbol TSLA.
 * The sample data has no addresses, so it matches by symbol.
 */
export function analyseStocks(trades: ClosedTrade[], registry: StockRegistry | null, match: "address" | "symbol"): StockContext | null {
  if (!registry) return null;

  const lookup = (trade: ClosedTrade): StockInfo | undefined =>
    match === "address" ? (trade.assetId ? registry.byAddress.get(trade.assetId.toLowerCase()) : undefined) : registry.bySymbol.get(trade.coin);

  const sessions = new Map<Session, Bucket>(
    SESSION_ORDER.map((session, index) => [session, { key: String(index), label: SESSION_LABELS[session], trades: 0, pnl: 0, wins: 0 }]),
  );
  const tokens = new Map<string, { info: StockInfo; trades: number; pnl: number; wins: number; decided: number }>();
  let stockTrades = 0;
  let otherTrades = 0;
  let stockPnl = 0;
  let otherPnl = 0;

  for (const trade of trades) {
    const info = lookup(trade);
    if (!info) {
      otherTrades += 1;
      otherPnl += trade.pnl;
      continue;
    }

    stockTrades += 1;
    stockPnl += trade.pnl;

    const bucket = sessions.get(marketSession(trade.closedAt))!;
    bucket.trades += 1;
    bucket.pnl += trade.pnl;
    if (trade.pnl > 0) bucket.wins += 1;

    const token = tokens.get(info.symbol) ?? { info, trades: 0, pnl: 0, wins: 0, decided: 0 };
    token.trades += 1;
    token.pnl += trade.pnl;
    if (trade.pnl !== 0) token.decided += 1;
    if (trade.pnl > 0) token.wins += 1;
    tokens.set(info.symbol, token);
  }

  if (!stockTrades) return null;

  const stats: StockTokenStat[] = [...tokens.values()]
    .map((token) => ({
      symbol: token.info.symbol,
      name: token.info.name,
      trades: token.trades,
      pnl: token.pnl,
      winRate: token.decided ? token.wins / token.decided : 0,
    }))
    .sort((a, b) => b.trades - a.trades);

  return { stockTrades, otherTrades, stockPnl, otherPnl, sessions: [...sessions.values()], tokens: stats };
}

export function stockInsights(context: StockContext | null): Insight[] {
  if (!context) return [];
  const insights: Insight[] = [];

  // Stock tokens against everything else the wallet trades.
  if (context.stockTrades >= MIN_GROUP && context.otherTrades >= MIN_GROUP) {
    const { stockPnl, otherPnl, stockTrades, otherTrades } = context;
    if (stockPnl > 0 && otherPnl < 0) {
      insights.push({
        id: "stocks-split",
        tone: "caution",
        title: "Your losses are outside stock tokens",
        stat: formatUsd(otherPnl, { signed: true, compact: true }),
        body: `Robinhood stock tokens made ${formatUsd(stockPnl, { signed: true })} over ${stockTrades} trades, while everything else lost ${formatUsd(Math.abs(otherPnl))} over ${otherTrades}. The stock side of your trading is working and the rest is giving it back.`,
      });
    } else if (stockPnl < 0 && otherPnl > 0) {
      insights.push({
        id: "stocks-split",
        tone: "neutral",
        title: "You make your money outside stock tokens",
        stat: formatUsd(otherPnl, { signed: true, compact: true }),
        body: `Other tokens made ${formatUsd(otherPnl, { signed: true })} over ${otherTrades} trades, while stock tokens lost ${formatUsd(Math.abs(stockPnl))} over ${stockTrades}.`,
      });
    }
  }

  // Regular hours against everywhere else on the clock.
  const regular = context.sessions[0];
  const off = context.sessions.slice(1).reduce((total, bucket) => ({ trades: total.trades + bucket.trades, pnl: total.pnl + bucket.pnl, wins: total.wins + bucket.wins }), { trades: 0, pnl: 0, wins: 0 });
  if (regular.trades >= MIN_GROUP && off.trades >= MIN_GROUP) {
    const regularAvg = regular.pnl / regular.trades;
    const offAvg = off.pnl / off.trades;
    if (offAvg < regularAvg && off.pnl < 0) {
      insights.push({
        id: "stocks-offhours",
        tone: "caution",
        title: "Stock trades outside regular hours lose money",
        stat: formatUsd(off.pnl, { signed: true, compact: true }),
        body: `${off.trades} stock trades closed outside 9:30am to 4pm ET lost ${formatUsd(Math.abs(off.pnl))} (${formatPercent(off.wins / off.trades, 0)} won), against ${formatUsd(regularAvg, { signed: true })} per trade during regular hours. Liquidity is thinner and prices can gap when the underlying market reopens.`,
      });
    } else if (offAvg > regularAvg && off.pnl > 0) {
      insights.push({
        id: "stocks-offhours",
        tone: "positive",
        title: "You do well outside regular hours",
        stat: formatUsd(offAvg, { signed: true }),
        body: `Stock trades closed outside regular hours averaged ${formatUsd(offAvg, { signed: true })} over ${off.trades} trades, against ${formatUsd(regularAvg, { signed: true })} during regular hours. Keep an eye on liquidity, since thin books are where prices slip.`,
      });
    }
  }

  return insights;
}
