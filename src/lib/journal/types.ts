export const DIRECTIONS = ["Long", "Short"] as const;
export const SETUPS = ["Breakout", "Reversal", "Trend continuation", "News / event", "Other"] as const;
export const EMOTIONS = ["Calm", "Focused", "Anxious", "FOMO", "Frustrated"] as const;
export const RULES = ["Followed plan", "Partial deviation", "Rule break"] as const;

export const UNSPECIFIED = "Unspecified";
export const NOT_RECORDED = "Not recorded";

/** One trade the user logged by hand or imported from a file. */
export interface JournalEntry {
  id: string;
  asset: string;
  direction: (typeof DIRECTIONS)[number];
  /** Realized profit or loss in USD. */
  pnl: number;
  /** Position size in USD. Zero when it was not recorded. */
  size: number;
  setup: string;
  emotion: string;
  rules: string;
  notes: string;
  /** ISO timestamp of when the trade was closed. */
  date: string;
}
