import { describe, expect, it } from "vitest";
import { analyseFumbles, pickTokens, salesFrom } from "./fumbles";
import type { PriceHistory, Sale } from "./fumbles";
import type { Fill } from "./types";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 5, 1);

const sale = (overrides: Partial<Sale> = {}): Sale => ({ key: "solana:MINT", assetId: "MINT", coin: "CAT", time: T0, size: 100, price: 1, ...overrides });

/** Hourly candles from T0, one per price, with the high equal to the close unless given. */
const history = (closes: number[], current: number, highs: number[] = closes): PriceHistory => ({
  candles: closes.map((close, i) => ({ t: T0 + i * HOUR, high: highs[i], close })),
  current,
});

describe("salesFrom", () => {
  const fill = (overrides: Partial<Fill>): Fill => ({
    id: "x",
    coin: "CAT",
    price: 2,
    size: 10,
    isBuy: false,
    time: T0,
    dir: "Close Long",
    closedPnl: 0,
    fee: 0,
    orderId: "o",
    assetId: "MINT",
    ...overrides,
  });

  it("keeps closing fills of a known token and qualifies them by chain", () => {
    const sales = salesFrom([fill({}), fill({ dir: "Open Long", isBuy: true }), fill({ dir: "Gas", size: 0 }), fill({ assetId: undefined })], "solana");
    expect(sales).toEqual([{ key: "solana:MINT", assetId: "MINT", coin: "CAT", time: T0, size: 10, price: 2 }]);
  });
});

describe("pickTokens", () => {
  it("ranks tokens by value sold and counts the ones left out", () => {
    const sales = [sale({ key: "a", size: 1 }), sale({ key: "b", size: 50 }), sale({ key: "b", size: 60 }), sale({ key: "c", size: 100 })];
    expect(pickTokens(sales, 2)).toEqual({ keys: ["b", "c"], unchecked: 1 });
  });
});

describe("analyseFumbles", () => {
  it("measures the best price after each sale and the value today", () => {
    // Sold 100 at $1. It ran to $3, then settled at $2.
    const report = analyseFumbles([sale()], new Map([["solana:MINT", history([1, 2, 3, 2.5], 2)]]), 0, T0 + 10 * HOUR);
    const [token] = report.fumbles;
    expect(token.leftAtPeak).toBeCloseTo(200);
    expect(token.vsToday).toBeCloseTo(100);
    expect(token.peakPrice).toBe(3);
    expect(token.peakAt).toBe(T0 + 2 * HOUR);
    expect(report.leftAtPeak).toBeCloseTo(200);
    expect(report.soldUsd).toBeCloseTo(100);
    expect(report.goodExits).toEqual([]);
  });

  it("ignores highs from before the sale", () => {
    // A spike to $9 in the hour before selling is not money left on the table.
    const report = analyseFumbles([sale({ time: T0 + HOUR + 1 })], new Map([["solana:MINT", history([9, 1, 1.5], 1)]]), 0, T0 + 5 * HOUR);
    expect(report.fumbles[0].peakPrice).toBe(1.5);
    expect(report.fumbles[0].leftAtPeak).toBeCloseTo(50);
  });

  it("uses candle highs, not closes, for the peak", () => {
    const report = analyseFumbles([sale()], new Map([["solana:MINT", history([1, 1.2], 1, [1, 4])]]), 0, T0 + 5 * HOUR);
    expect(report.fumbles[0].peakPrice).toBe(4);
  });

  it("falls back to today's price when no candle comes after the sale", () => {
    const report = analyseFumbles([sale({ time: T0 + 10 * HOUR })], new Map([["solana:MINT", history([5, 5], 1.4)]]), 0, T0 + 11 * HOUR);
    expect(report.fumbles[0].peakPrice).toBe(1.4);
    expect(report.fumbles[0].peakAt).toBe(T0 + 11 * HOUR);
  });

  it("counts a sale before a crash as a good exit", () => {
    const report = analyseFumbles([sale({ price: 2 })], new Map([["solana:MINT", history([2, 1, 0.5], 0.5)]]), 0, T0 + 5 * HOUR);
    expect(report.fumbles).toEqual([]);
    expect(report.goodExits[0].vsToday).toBeCloseTo(-150);
    expect(report.leftAtPeak).toBe(0);
  });

  it("measures each sale against the peak after it, and averages the sale price by size", () => {
    const sales = [sale({ size: 100, price: 1 }), sale({ time: T0 + 3 * HOUR, size: 300, price: 3 })];
    // Peaks at $4 in hour 2, before the second sale, then only reaches $3.5.
    const report = analyseFumbles(sales, new Map([["solana:MINT", history([1, 2, 4, 3, 3.5], 3)]]), 0, T0 + 6 * HOUR);
    const [token] = report.fumbles;
    expect(token.sales).toBe(2);
    expect(token.avgSellPrice).toBeCloseTo(2.5);
    // First sale: 100 x (4 - 1) = 300. Second: 300 x (3.5 - 3) = 150.
    expect(token.leftAtPeak).toBeCloseTo(450);
  });

  it("skips tokens without a price history and reports them as unchecked", () => {
    const sales = [sale(), sale({ key: "solana:OTHER", assetId: "OTHER" })];
    const report = analyseFumbles(sales, new Map([["solana:MINT", history([1, 2], 2)]]), 3, T0 + 5 * HOUR);
    expect(report.checked).toBe(1);
    expect(report.unchecked).toBe(4);
  });

  it("thins long paths for the sparkline and ends at today's price", () => {
    const closes = Array.from({ length: 500 }, (_, i) => 1 + i / 100);
    const report = analyseFumbles([sale()], new Map([["solana:MINT", history(closes, 7)]]), 0, T0 + 600 * HOUR);
    const { path } = report.fumbles[0];
    expect(path.length).toBeLessThanOrEqual(48);
    expect(path.at(-1)).toEqual({ t: T0 + 600 * HOUR, price: 7 });
  });
});
