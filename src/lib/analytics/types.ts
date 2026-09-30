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
  /** Contract address of the asset traded, when the source knows it. */
  assetId?: string;
  /** On closing fills: when the shares being sold were acquired, weighted by quantity. */
  openedAt?: number;
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
  assetId?: string;
  /** When the position was opened, if the source recorded it. */
  openedAt?: number;
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
  kind: "address" | "handle" | "portfolio";
}

export interface HoldingStats {
  /** Trades that had an open time, which is what every figure here is based on. */
  trades: number;
  avgMs: number;
  medianMs: number;
  winnersAvgMs: number | null;
  losersAvgMs: number | null;
  /** How the holding period relates to results, from quick flips to long holds. */
  buckets: Bucket[];
}

export interface WhatIf {
  id: string;
  label: string;
  detail: string;
  /** Change in net trade P&L if the scenario had applied. */
  delta: number;
  tradesAffected: number;
}

export interface RiskStats {
  /** Mean daily P&L over its standard deviation, annualised. Null without enough days. */
  sharpe: number | null;
  /** Like Sharpe but only penalises losing days. */
  sortino: number | null;
  /** Fraction of capital the edge suggests risking per trade. Zero or negative means no edge. */
  kelly: number | null;
  /** Net P&L divided by max drawdown. */
  recoveryFactor: number | null;
  /** The longest stretch spent below a previous equity peak. */
  longestDrawdownMs: number;
  /** Still below the peak as of the last trade. */
  underwater: boolean;
  currentDrawdown: number;
  /** The loss that 1 trade in 20 exceeds. Negative when it is a loss. */
  var95: number | null;
  /** Worst loss as a multiple of the average loss. */
  tailRatio: number | null;
  whatIfs: WhatIf[];
}

export interface StockInfo {
  symbol: string;
  name: string;
}

export interface StockTokenStat {
  symbol: string;
  name: string;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface StockContext {
  stockTrades: number;
  otherTrades: number;
  stockPnl: number;
  otherPnl: number;
  /** Stock trades grouped by the US market session they were closed in. */
  sessions: Bucket[];
  tokens: StockTokenStat[];
}

/** One point per closed trade, for the interactive equity chart. */
export interface TradePoint {
  t: number;
  /** Running realized P&L after this trade, every fee included, so the last point equals net P&L. */
  v: number;
  /** This trade's own P&L. */
  pnl: number;
  coin: string;
  /** Distance below the previous high at this point. Zero or negative. */
  drawdown: number;
}

export interface DayCell {
  /** UTC midnight of the day. */
  t: number;
  pnl: number;
  trades: number;
}

export interface HourCell {
  pnl: number;
  trades: number;
}

export interface Visuals {
  /** Thinned to a chartable size for very active wallets; the final point is always kept. */
  series: TradePoint[];
  /** Calendar days from the Monday on or before the first shown day. */
  calendar: DayCell[];
  /** True when the calendar only covers the most recent year of a longer history. */
  calendarClipped: boolean;
  /** [weekday, Monday first][hour, UTC] */
  hourWeekday: HourCell[][];
}

export interface SubScore {
  key: "edge" | "risk" | "discipline";
  label: string;
  value: number;
  blurb: string;
}

export interface NeuroScore {
  value: number;
  parts: SubScore[];
  /** Too few trades for the score to mean much. */
  lowConfidence: boolean;
}

export interface WalletReport {
  subject: Subject;
  source: "robinhood" | "solana" | "demo" | "journal" | "portfolio";
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
  /** Null when the source did not record open times. */
  holding: HoldingStats | null;
  /** Null when there is too little activity to say anything. */
  risk: RiskStats | null;
  /** Null when no Robinhood stock tokens were traded, or stocks could not be identified. */
  stocks: StockContext | null;
  /** One-sentence summary of the result and the main habits behind it. Empty when there are no trades. */
  verdict: string;
  /** Null when there are no closed trades. */
  score: NeuroScore | null;
  /** Null when there are no closed trades. */
  visuals: Visuals | null;
}
