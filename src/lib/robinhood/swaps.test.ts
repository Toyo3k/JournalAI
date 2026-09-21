import { describe, expect, it } from "vitest";
import { makePriceLookup } from "./prices";
import { reconstructTrades } from "./swaps";
import type { Transfer } from "./swaps";

const HOUR = 3_600_000;
const ethUsd = () => 2000;

const move = (hash: string, time: number, symbol: string, amount: number, direction: "in" | "out", assetId = symbol.toLowerCase()): Transfer => ({
  hash,
  time,
  assetId,
  symbol,
  amount,
  direction,
});

describe("reconstructTrades", () => {
  it("values a stablecoin swap and realizes P&L against average cost", () => {
    const { fills, swaps } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [
        move("0xa", HOUR, "USDC", 1000, "out"),
        move("0xa", HOUR, "AAPL", 10, "in"),
        move("0xb", 2 * HOUR, "AAPL", 10, "out"),
        move("0xb", 2 * HOUR, "USDC", 1200, "in"),
      ],
    });

    expect(swaps).toBe(2);
    expect(fills).toHaveLength(2);
    expect(fills[0]).toMatchObject({ dir: "Open Long", coin: "AAPL", closedPnl: 0, size: 10 });
    expect(fills[1]).toMatchObject({ dir: "Close Long", closedPnl: 200, size: 10 });
  });

  it("prices ETH legs, treating native ETH and WETH as one asset", () => {
    const { fills } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [
        move("0xa", HOUR, "ETH", 1, "out", "native"),
        move("0xa", HOUR, "TSLA", 8, "in"),
        move("0xb", 2 * HOUR, "TSLA", 8, "out"),
        move("0xb", 2 * HOUR, "WETH", 1.5, "in", "0xweth"),
      ],
    });

    expect(fills[0].price * fills[0].size).toBeCloseTo(2000);
    expect(fills[1].closedPnl).toBeCloseTo(1000);
  });

  it("uses average cost across several buys and reduces the position proportionally", () => {
    const { fills } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [
        move("0x1", HOUR, "USDC", 100, "out"),
        move("0x1", HOUR, "XYZ", 10, "in"),
        move("0x2", 2 * HOUR, "USDC", 300, "out"),
        move("0x2", 2 * HOUR, "XYZ", 10, "in"),
        // average cost is $20 per token. Selling 10 at $30 realizes $100.
        move("0x3", 3 * HOUR, "XYZ", 10, "out"),
        move("0x3", 3 * HOUR, "USDC", 300, "in"),
      ],
    });

    expect(fills.at(-1)?.closedPnl).toBeCloseTo(100);
  });

  it("dates each sale by the oldest shares it sold, using first in first out", () => {
    const { fills } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [
        move("0x1", 1 * HOUR, "USDC", 100, "out"),
        move("0x1", 1 * HOUR, "XYZ", 10, "in"),
        move("0x2", 5 * HOUR, "USDC", 100, "out"),
        move("0x2", 5 * HOUR, "XYZ", 10, "in"),
        // Sells 15: all of the first lot (bought at 1h) and half of the second (bought at 5h).
        move("0x3", 9 * HOUR, "XYZ", 15, "out"),
        move("0x3", 9 * HOUR, "USDC", 300, "in"),
        // Sells the remaining 5, which all came from the second lot.
        move("0x4", 11 * HOUR, "XYZ", 5, "out"),
        move("0x4", 11 * HOUR, "USDC", 100, "in"),
      ],
    });

    const sells = fills.filter((fill) => fill.dir === "Close Long");
    // (10 x 1h + 5 x 5h) / 15 = 2.33h
    expect(sells[0].openedAt).toBeCloseTo((10 * 1 + 5 * 5) / 15 * HOUR);
    expect(sells[1].openedAt).toBe(5 * HOUR);
    expect(fills.filter((fill) => fill.dir === "Open Long").every((fill) => fill.openedAt === undefined)).toBe(true);
  });

  it("records the contract address so stock tokens can be identified", () => {
    const { fills } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [move("0x1", HOUR, "USDC", 100, "out"), move("0x1", HOUR, "TSLA", 1, "in", "0xabc")],
    });
    expect(fills[0].assetId).toBe("0xabc");
  });

  it("ignores wraps, plain transfers and stable-to-ETH conversions", () => {
    const { fills, swaps } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [
        move("0xwrap", HOUR, "ETH", 1, "out", "native"),
        move("0xwrap", HOUR, "WETH", 1, "in", "0xweth"),
        move("0xconv", HOUR, "USDC", 2000, "out"),
        move("0xconv", HOUR, "ETH", 1, "in", "native"),
        move("0xairdrop", HOUR, "FREE", 500, "in"),
      ],
    });

    expect(swaps).toBe(0);
    expect(fills).toHaveLength(0);
  });

  it("counts token-to-token swaps as skipped rather than guessing a price", () => {
    const { fills, skipped } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [move("0xa", HOUR, "AAA", 5, "out"), move("0xa", HOUR, "BBB", 9, "in")],
    });

    expect(skipped).toBe(1);
    expect(fills).toHaveLength(0);
  });

  it("leaves out sales that have no earlier purchase", () => {
    const { fills, untracked } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [move("0xa", HOUR, "OLD", 10, "out"), move("0xa", HOUR, "USDC", 500, "in")],
    });

    expect(untracked).toBe(1);
    expect(fills).toHaveLength(0);
  });

  it("only realizes the tracked part of a sale larger than the known position", () => {
    const { fills } = reconstructTrades({
      ethUsd,
      gas: [],
      transfers: [
        move("0x1", HOUR, "USDC", 100, "out"),
        move("0x1", HOUR, "XYZ", 10, "in"),
        // 20 sold for $400, but only 10 tokens were bought. Proceeds for those are $200 against $100 cost.
        move("0x2", 2 * HOUR, "XYZ", 20, "out"),
        move("0x2", 2 * HOUR, "USDC", 400, "in"),
      ],
    });

    expect(fills.at(-1)).toMatchObject({ size: 10 });
    expect(fills.at(-1)?.closedPnl).toBeCloseTo(100);
  });

  it("attaches gas to its swap and turns other gas into fee-only fills", () => {
    const { fills } = reconstructTrades({
      ethUsd,
      transfers: [move("0xa", HOUR, "USDC", 100, "out"), move("0xa", HOUR, "XYZ", 10, "in")],
      gas: [
        { hash: "0xa", time: HOUR, eth: 0.001 },
        { hash: "0xapprove", time: HOUR / 2, eth: 0.0005 },
      ],
    });

    const swap = fills.find((fill) => fill.orderId === "0xa");
    const gasOnly = fills.find((fill) => fill.dir === "Gas");
    expect(swap?.fee).toBeCloseTo(2);
    expect(gasOnly).toMatchObject({ size: 0, closedPnl: 0 });
    expect(gasOnly?.fee).toBeCloseTo(1);
  });
});

describe("makePriceLookup", () => {
  const lookup = makePriceLookup([
    [1000, 10],
    [2000, 20],
    [3000, 30],
  ]);

  it("returns the latest point at or before the time", () => {
    expect(lookup(2500)).toBe(20);
    expect(lookup(3000)).toBe(30);
    expect(lookup(9999)).toBe(30);
  });

  it("falls back to the first point for earlier times", () => {
    expect(lookup(1)).toBe(10);
  });
});
