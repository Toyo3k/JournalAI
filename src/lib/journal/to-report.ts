import { buildReport } from "../analytics";
import type { Fill, WalletReport } from "../analytics/types";
import { journalPatterns } from "./patterns";
import type { JournalPatterns } from "./patterns";
import type { JournalEntry } from "./types";

/** Each entry is already a finished trade, so it becomes one closing fill carrying its P&L. */
export function entriesToFills(entries: JournalEntry[]): Fill[] {
  return entries.map((entry) => ({
    id: entry.id,
    coin: entry.asset,
    // Position size is stored as the notional, so price x size equals the dollar size.
    price: entry.size,
    size: entry.size > 0 ? 1 : 0,
    isBuy: entry.direction === "Short",
    time: Date.parse(entry.date),
    dir: `Close ${entry.direction}`,
    closedPnl: entry.pnl,
    fee: 0,
    orderId: entry.id,
  }));
}

export function buildJournalReport(entries: JournalEntry[]): { report: WalletReport; patterns: JournalPatterns } {
  const patterns = journalPatterns(entries);
  const report = buildReport({
    subject: { id: "journal", label: "My journal", kind: "handle" },
    source: "journal",
    fills: entriesToFills(entries),
    capabilities: { shorts: true, fees: false },
    notes: [],
    extraInsights: patterns.insights,
  });
  return { report, patterns };
}
