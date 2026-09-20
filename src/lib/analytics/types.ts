export type Side = "Long" | "Short";

/** A single execution, normalised from the exchange payload. */
export interface Fill {
  id: string;
  coin: string;
  price: number;
  size: number;
  /** Buy or sell, from the taker's point of view of the fill. */
  isBuy: boolean;
  time: number;
  dir: string;
  closedPnl: number;
  fee: number;
  orderId: number;
  /** True when the wallet was the taker. */
  crossed: boolean;
}

/** One or more closing fills from the same order, grouped into a trade. */
export interface ClosedTrade {
  id: string;
  coin: string;
  side: Side;
  closedAt: number;
  /** Realized P&L net of the fees paid on the closing fills. */
  pnl: number;
  fees: number;
  notional: number;
}

export interface EquityPoint {
  t: number;
  /** Cumulative realized P&L after all fees. */
  v: number;
}

export interface Summary {
  fillCount: number;
  tradeCount: number;
  firstFillAt: number;
  lastFillAt: number;
  activeDays: number;
  volume: number;
  fees: number;
  netPnl: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  /** Average win divided by average loss. Null when there are no losses. */
  payoffRatio: number | null;
  /** Gross profit divided by gross loss. Null when there are no losses. */
  profitFactor: number | null;
  expectancy: number;
  best: ClosedTrade | null;
  worst: ClosedTrade | null;
  maxDrawdown: number;
  longestWinStreak: number;
  longestLossStreak: number;
  /** Share of fills where the wallet provided liquidity. */
  makerShare: number;
}

export interface Bucket {
  key: string;
  label: string;
  trades: number;
  pnl: number;
  wins: number;
}

export interface AssetStat {
  coin: string;
  trades: number;
  pnl: number;
  winRate: number;
  volume: number;
}

export interface SideStat {
  side: Side;
  trades: number;
  pnl: number;
  winRate: number;
}

export type InsightTone = "positive" | "caution" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  /** Short figure shown beside the insight, e.g. "2.3x". */
  stat?: string;
}

export interface AccountSnapshot {
  accountValue: number;
  openPositions: number;
}

export interface WalletReport {
  address: string;
  source: "hyperliquid" | "demo";
  generatedAt: number;
  /** True when the exchange history window was capped and older fills are missing. */
  truncated: boolean;
  account: AccountSnapshot | null;
  summary: Summary;
  equity: EquityPoint[];
  assets: AssetStat[];
  sides: SideStat[];
  hours: Bucket[];
  weekdays: Bucket[];
  recentTrades: ClosedTrade[];
  insights: Insight[];
}
