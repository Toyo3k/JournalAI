import { EMOTIONS, NOT_RECORDED, RULES, SETUPS, UNSPECIFIED } from "./types";
import type { JournalEntry } from "./types";
import { newId } from "./storage";

export class CsvError extends Error {}

/** Splits CSV text into rows, honouring quoted fields, escaped quotes and CRLF line endings. */
export function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      endCell();
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      endRow();
    } else {
      cell += char;
    }
  }
  if (cell || row.length) endRow();
  return rows;
}

/** "$1,234.50", "-12", "(45.10)" and "+3" all parse. Anything else is NaN. */
export function parseMoney(value: string): number {
  const text = value.trim();
  if (!text) return NaN;
  const negative = /^\(.*\)$/.test(text);
  const number = Number(text.replace(/[()$,\s+]/g, ""));
  return negative ? -Math.abs(number) : number;
}

const canonical = (value: string, options: readonly string[]) =>
  options.find((option) => option.toLowerCase() === value.trim().toLowerCase());

function normaliseRules(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return NOT_RECORDED;
  const exact = canonical(text, RULES);
  if (exact) return exact;
  if (/partial|some/.test(text)) return "Partial deviation";
  if (/break|broke|violat|^no$|^false$|^n$/.test(text)) return "Rule break";
  if (/follow|^yes$|^true$|^y$|plan|stuck/.test(text)) return "Followed plan";
  return NOT_RECORDED;
}

const HEADERS = {
  asset: ["symbol", "ticker", "asset", "market", "coin", "instrument"],
  pnl: ["realizedpnl", "realizedpl", "pnl", "pnlusd", "profitloss", "profit", "netpnl", "netpl", "netprofit", "pl", "result"],
  side: ["side", "direction"],
  size: ["size", "notional", "positionsize", "value"],
  setup: ["setup", "strategy"],
  emotion: ["emotion", "feeling", "mood"],
  rules: ["rules", "ruleadherence", "adherence"],
  notes: ["notes", "note", "comment", "comments", "thesis"],
  date: ["date", "closedat", "exitdate", "closedate", "time", "timestamp"],
} as const;

export interface CsvImport {
  entries: JournalEntry[];
  /** Rows that were dropped because the ticker or P&L was missing or unreadable. */
  skipped: number;
}

/**
 * Turns a CSV export into journal entries. Only a ticker and a realized P&L
 * are required. Everything else falls back to "unspecified" so a broker export
 * with a few columns still imports.
 */
export function importCsv(text: string, now = Date.now()): CsvImport {
  const rows = parseRows(text);
  if (rows.length < 2) throw new CsvError("The file needs a header row and at least one trade.");

  const header = rows[0].map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const column = (names: readonly string[]) => header.findIndex((name) => names.includes(name));
  const index = Object.fromEntries(Object.entries(HEADERS).map(([key, names]) => [key, column(names)])) as Record<keyof typeof HEADERS, number>;

  if (index.asset < 0 || index.pnl < 0) {
    throw new CsvError("Could not find a symbol or ticker column and a realized P&L column.");
  }

  const body = rows.slice(1);
  const cell = (row: string[], key: keyof typeof HEADERS) => (index[key] >= 0 ? (row[index[key]] ?? "") : "");
  const entries: JournalEntry[] = [];
  let skipped = 0;

  body.forEach((row, position) => {
    const asset = cell(row, "asset").toUpperCase();
    const pnl = parseMoney(cell(row, "pnl"));
    if (!asset || !Number.isFinite(pnl)) {
      skipped += 1;
      return;
    }

    const parsedDate = Date.parse(cell(row, "date"));
    // Rows without a date keep their file order by being spaced a minute apart, ending now.
    const time = Number.isNaN(parsedDate) ? now - (body.length - position) * 60_000 : parsedDate;
    const size = Math.abs(parseMoney(cell(row, "size")));

    entries.push({
      id: newId(),
      asset,
      direction: /short|sell/i.test(cell(row, "side")) ? "Short" : "Long",
      pnl,
      size: Number.isFinite(size) ? size : 0,
      setup: canonical(cell(row, "setup"), SETUPS) ?? (cell(row, "setup").trim() || UNSPECIFIED),
      emotion: canonical(cell(row, "emotion"), EMOTIONS) ?? (cell(row, "emotion").trim() || UNSPECIFIED),
      rules: normaliseRules(cell(row, "rules")),
      notes: cell(row, "notes"),
      date: new Date(time).toISOString(),
    });
  });

  return { entries, skipped };
}
