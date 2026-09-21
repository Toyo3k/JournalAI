import { describe, expect, it } from "vitest";
import { buildReport } from "./index";
import { compareReports, sharedMarkets } from "./compare";
import type { Fill, WalletReport } from "./types";
import { generateDemoFills } from "../demo/generate";

const DAY = 86_400_000;
const capabilities = { shorts: false, fees: true };

/** One closed trade as a single closing fill, sized in dollars. */
function trade(index: number, coin: string, pnl: number, notional: number): Fill {
  return {
    id: `t${index}`,
    coin,
    price: notional,
    size: 1,
    isBuy: false,
    time: Date.UTC(2026, 7, 1) + index * DAY,
    dir: "Close Long",
    closedPnl: pnl,
    fee: 0,
    orderId: `o${index}`,
  };
}

const report = (fills: Fill[]): WalletReport =>
  buildReport({ subject: { id: "0x1", label: "0x1", kind: "address" }, source: "demo", fills, capabilities });

const rowOf = (fills: [WalletReport, WalletReport], key: string) =>
  compareReports(fills[0], fills[1], "A", "B").rows.find((row) => row.key === key)!;

describe("compareReports", () => {
  it("marks winners in the right direction, including lower-is-better metrics", () => {
    const strong = report(Array.from({ length: 30 }, (_, i) => trade(i, "TSLA", i % 4 === 0 ? -20 : 50, 1000)));
    const weak = report(Array.from({ length: 30 }, (_, i) => trade(i, "TSLA", i % 2 === 0 ? -50 : 20, 1000)));
    const pair: [WalletReport, WalletReport] = [strong, weak];

    expect(rowOf(pair, "netPnl").winner).toBe("a");
    expect(rowOf(pair, "winRate").winner).toBe("a");
    expect(rowOf(pair, "drawdown").winner).toBe("a");
    expect(rowOf(pair, "trades").winner).toBeNull();
  });

  it("calls near-identical values a tie", () => {
    const one = report(Array.from({ length: 25 }, (_, i) => trade(i, "TSLA", i % 2 ? 10 : -5, 1000)));
    expect(rowOf([one, one], "netPnl").winner).toBe("tie");
  });

  it("treats a profit factor with no losses as beating any finite one", () => {
    const perfect = report(Array.from({ length: 25 }, (_, i) => trade(i, "TSLA", 10, 1000)));
    const mixed = report(Array.from({ length: 25 }, (_, i) => trade(i, "TSLA", i % 2 ? 30 : -10, 1000)));
    const row = rowOf([perfect, mixed], "profitFactor");
    expect(row.a).toBe(Number.POSITIVE_INFINITY);
    expect(row.winner).toBe("a");
  });

  it("leaves a metric undecided when one side has no value", () => {
    const noTrades = report([]);
    const some = report(Array.from({ length: 25 }, (_, i) => trade(i, "TSLA", 10, 1000)));
    expect(rowOf([noTrades, some], "perDollar").winner).toBeNull();
  });

  it("explains when the wallet that made more is not the one that traded better", () => {
    const big = report(Array.from({ length: 30 }, (_, i) => trade(i, "TSLA", 10, 10_000)));
    const small = report(Array.from({ length: 30 }, (_, i) => trade(i, "TSLA", 5, 1_000)));

    const { verdict } = compareReports(big, small, "Big", "Small");

    expect(verdict[0]).toMatch(/Big made more in total/);
    expect(verdict[0]).toMatch(/Small earned more for every dollar traded/);
  });

  it("flags a small sample", () => {
    const tiny = report([trade(0, "TSLA", 5, 100)]);
    const enough = report(Array.from({ length: 25 }, (_, i) => trade(i, "TSLA", 10, 1000)));
    expect(compareReports(tiny, enough, "A", "B").smallSample).toBe(true);
    expect(compareReports(enough, enough, "A", "B").smallSample).toBe(false);
  });
});

describe("sharedMarkets", () => {
  it("lists only markets both wallets traded, biggest first", () => {
    const a = report([trade(0, "TSLA", 5, 5000), trade(1, "AAPL", 5, 100), trade(2, "NVDA", 5, 100)]);
    const b = report([trade(0, "TSLA", 5, 1000), trade(1, "NVDA", 5, 2000), trade(2, "AMZN", 5, 100)]);
    expect(sharedMarkets(a, b).map((market) => market.coin)).toEqual(["TSLA", "NVDA"]);
  });
});

describe("sample wallets", () => {
  it("produce a full comparison with a bounded, non-empty verdict", () => {
    const a = buildReport({ subject: { id: "a", label: "A", kind: "address" }, source: "demo", fills: generateDemoFills("active"), capabilities });
    const b = buildReport({ subject: { id: "b", label: "B", kind: "address" }, source: "demo", fills: generateDemoFills("steady"), capabilities });

    const result = compareReports(a, b, "Active", "Steady");

    expect(result.rows.length).toBeGreaterThan(8);
    expect(result.verdict.length).toBeGreaterThan(0);
    expect(result.verdict.length).toBeLessThanOrEqual(5);
    expect(result.shared.length).toBeGreaterThan(0);
    expect(result.smallSample).toBe(false);
  });
});
