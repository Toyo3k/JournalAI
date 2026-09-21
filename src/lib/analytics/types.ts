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
  orderId: string;
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

/** What a data source can and cannot tell us, so the UI never claims more than it knows. */
export interface Capabilities {
  /** The venue supports short positions. False for spot and on-chain swaps. */
  shorts: boolean;
  /** Fees are known. False when the source only reports P&L. */
  fees: boolean;
}

export interface Subject {
  /** Address or handle exactly as used in the URL. */
  id: string;
  /** Human-readable form, shortened for addresses and prefixed with @ for handles. */
  label: string;
  kind: "address" | "handle";
}

export interface WalletReport {
  subject: Subject;
  source: "robinhood" | "demo" | "journal";
  capabilities: Capabilities;
  /** Source-specific caveats worth showing next to the numbers. */
  notes: string[];
  generatedAt: number;
  /** True when the exchange history window was capped and older fills are missing. */
  truncated: boolean;
  summary: Summary;
  equity: EquityPoint[];
  assets: AssetStat[];
  sides: SideStat[];
  hours: Bucket[];
  weekdays: Bucket[];
  recentTrades: ClosedTrade[];
  insights: Insight[];
}
