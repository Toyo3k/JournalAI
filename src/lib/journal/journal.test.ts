import { describe, expect, it } from "vitest";
import { CsvError, importCsv, parseMoney, parseRows } from "./csv";
import { journalPatterns } from "./patterns";
import { parseEntries } from "./storage";
import { buildJournalReport, entriesToFills } from "./to-report";
import type { JournalEntry } from "./types";

const entry = (overrides: Partial<JournalEntry>): JournalEntry => ({
  id: Math.random().toString(36).slice(2),
  asset: "BTC",
  direction: "Long",
  pnl: 100,
  size: 0,
  setup: "Breakout",
  emotion: "Calm",
  rules: "Followed plan",
  notes: "",
  date: "2026-08-01T12:00:00.000Z",
  ...overrides,
});

describe("parseRows", () => {
  it("handles quoted commas, escaped quotes, CRLF and a missing final newline", () => {
    const rows = parseRows('a,b\r\n"x, y","say ""hi"""\r\nlast,row');
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["last", "row"]]);
  });

  it("skips blank lines and keeps newlines inside quotes", () => {
    expect(parseRows('a,b\n\n"line1\nline2",z\n')).toEqual([["a", "b"], ["line1\nline2", "z"]]);
  });
});

describe("parseMoney", () => {
  it.each([
    ["$1,234.50", 1234.5],
    ["-12", -12],
    ["(45.10)", -45.1],
    ["+3", 3],
    [" 7 ", 7],
  ])("parses %s", (input, expected) => expect(parseMoney(input)).toBeCloseTo(expected));

  it("returns NaN for anything unreadable", () => {
    expect(parseMoney("")).toBeNaN();
    expect(parseMoney("abc")).toBeNaN();
  });
});

describe("importCsv", () => {
  it("imports rows with flexible header names and normalises values", () => {
    const csv = [
      "Ticker,Net P&L,Side,Strategy,Feeling,Rule Adherence,Notes,Closed At",
      'NVDA,"$1,200.50",sell,Breakout,fomo,Broke the rules,"chased, again",2026-08-03T10:00:00Z',
      "eth,(80),Long,Custom setup,,yes,,2026-08-04",
    ].join("\n");

    const { entries, skipped } = importCsv(csv);

    expect(skipped).toBe(0);
    expect(entries[0]).toMatchObject({ asset: "NVDA", pnl: 1200.5, direction: "Short", setup: "Breakout", emotion: "FOMO", rules: "Rule break", notes: "chased, again" });
    expect(entries[1]).toMatchObject({ asset: "ETH", pnl: -80, setup: "Custom setup", emotion: "Unspecified", rules: "Followed plan" });
  });

  it("counts rows without a ticker or a readable P&L as skipped", () => {
    const { entries, skipped } = importCsv("symbol,pnl\nBTC,10\n,20\nETH,oops\nSOL,5");
    expect(entries.map((e) => e.asset)).toEqual(["BTC", "SOL"]);
    expect(skipped).toBe(2);
  });

  it("keeps file order for rows without dates", () => {
    const { entries } = importCsv("symbol,pnl\nA,1\nB,2\nC,3", Date.UTC(2026, 8, 1));
    const times = entries.map((e) => Date.parse(e.date));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(3);
  });

  it("rejects files that are empty or missing the required columns", () => {
    expect(() => importCsv("symbol,pnl")).toThrow(CsvError);
    expect(() => importCsv("foo,bar\n1,2")).toThrow(/ticker column/);
  });
});

describe("parseEntries", () => {
  it("returns nothing for missing, corrupt or wrongly shaped storage", () => {
    expect(parseEntries(null)).toEqual([]);
    expect(parseEntries("{not json")).toEqual([]);
    expect(parseEntries('{"a":1}')).toEqual([]);
  });

  it("drops invalid entries but keeps valid ones", () => {
    const good = entry({ id: "ok" });
    const raw = JSON.stringify([good, { id: "bad", asset: "X", pnl: "12", date: "x", direction: "Long" }, null]);
    expect(parseEntries(raw).map((e) => e.id)).toEqual(["ok"]);
  });
});

describe("journal report", () => {
  it("turns entries into closing fills whose size is the recorded notional", () => {
    const [fill] = entriesToFills([entry({ pnl: -50, size: 2000, direction: "Short" })]);
    expect(fill).toMatchObject({ dir: "Close Short", closedPnl: -50, isBuy: true });
    expect(fill.price * fill.size).toBe(2000);
  });

  it("feeds the shared analytics so totals match the entries", () => {
    const { report } = buildJournalReport([entry({ pnl: 100 }), entry({ pnl: -40 }), entry({ pnl: 60 })]);
    expect(report.summary.netPnl).toBe(120);
    expect(report.summary.tradeCount).toBe(3);
    expect(report.capabilities).toEqual({ shorts: true, fees: false });
  });
});

describe("journalPatterns", () => {
  const make = (count: number, overrides: Partial<JournalEntry>) => Array.from({ length: count }, () => entry(overrides));

  it("flags an emotion that loses money and one that makes it", () => {
    const { insights } = journalPatterns([...make(4, { emotion: "FOMO", pnl: -100 }), ...make(4, { emotion: "Calm", pnl: 80 })]);
    expect(insights.find((i) => i.id === "j-worst-emotion")?.title).toMatch(/fomo/i);
    expect(insights.find((i) => i.id === "j-best-emotion")?.title).toMatch(/calm/i);
  });

  it("compares planned trades against rule breaks", () => {
    const { insights, adherence } = journalPatterns([
      ...make(4, { rules: "Followed plan", pnl: 100 }),
      ...make(4, { rules: "Rule break", pnl: -60 }),
    ]);
    expect(adherence).toEqual({ followed: 4, recorded: 8 });
    expect(insights.find((i) => i.id === "j-plan-gap")?.tone).toBe("caution");
    expect(insights.some((i) => i.id === "j-low-adherence")).toBe(true);
  });

  it("stays quiet when groups are too small to compare", () => {
    const { insights } = journalPatterns([entry({ emotion: "FOMO", pnl: -100 }), entry({ emotion: "Calm", pnl: 50 })]);
    expect(insights).toEqual([]);
  });

  it("returns no adherence when it was never recorded", () => {
    expect(journalPatterns(make(3, { rules: "" })).adherence).toBeNull();
  });
});
