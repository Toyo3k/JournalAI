/**
 * Memecoin setups. Entries logged with the older stock-style setups (Breakout, Reversal and so on)
 * keep their text, since setups are grouped by what was saved.
 */
export const SETUPS = ["New launch", "KOL / call", "Dip buy", "Narrative play", "Volume spike", "Other"] as const;
export const EMOTIONS = ["Calm", "Focused", "Anxious", "FOMO", "Frustrated"] as const;
export const RULES = ["Followed plan", "Partial deviation", "Rule break"] as const;

export const UNSPECIFIED = "Unspecified";
export const NOT_RECORDED = "Not recorded";

/** One trade the user logged by hand or imported from a file. Memecoins are only bought and sold, so there is no long or short side. */
export interface JournalEntry {
  id: string;
  asset: string;
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
