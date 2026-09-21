import { describe, expect, it } from "vitest";
import { buildReport } from "./index";
import { marketSession } from "./sessions";
import type { StockRegistry } from "./stocks";
import type { Fill } from "./types";
import { formatDuration } from "../format";
import { parseRegistry } from "../robinhood/stocks";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 7, 3, 15); // Monday 3 Aug 2026, 11am ET, inside regular hours
const capabilities = { shorts: false, fees: true };

interface Spec {
  coin?: string;
  pnl: number;
  /** Hours the position was held before it closed. */
  held?: number;
  /** Days after T0 when it closed. */
  day: number;
  hour?: number;
  fee?: number;
  assetId?: string;
}

function fills(specs: Spec[]): Fill[] {
  return specs.map((spec, i) => {
    const closedAt = T0 + spec.day * DAY + (spec.hour ?? 0) * HOUR;
    return {
      id: `f${i}`,
      coin: spec.coin ?? "TSLA",
      price: 1000,
      size: 1,
      isBuy: false,
      time: closedAt,
      dir: "Close Long",
      closedPnl: spec.pnl,
      fee: spec.fee ?? 0,
      orderId: `o${i}`,
      assetId: spec.assetId,
      openedAt: spec.held === undefined ? undefined : closedAt - spec.held * HOUR,
    };
  });
}

const report = (specs: Spec[], stocks?: { registry: StockRegistry | null; match: "address" | "symbol" }) =>
  buildReport({ subject: { id: "x", label: "x", kind: "address" }, source: "demo", fills: fills(specs), capabilities, stocks });

describe("marketSession", () => {
  it.each([
    ["2026-09-22T14:00:00Z", "regular"], // Tue 10:00 ET
    ["2026-09-22T13:30:00Z", "regular"], // 9:30 ET on the dot
    ["2026-09-22T13:29:00Z", "premarket"],
    ["2026-09-22T12:00:00Z", "premarket"], // 8:00 ET
    ["2026-09-22T21:00:00Z", "afterhours"], // 17:00 ET
    ["2026-09-23T02:00:00Z", "overnight"], // Tue 22:00 ET
    ["2026-09-22T06:00:00Z", "overnight"], // Tue 02:00 ET
    ["2026-09-26T16:00:00Z", "closed"], // Saturday
  ])("%s is %s", (iso, expected) => expect(marketSession(Date.parse(iso))).toBe(expected));

  it("follows the 24/5 week: Sunday 8pm ET opens, Friday 8pm ET closes", () => {
    expect(marketSession(Date.parse("2026-09-27T23:00:00Z"))).toBe("closed"); // Sun 19:00 ET
    expect(marketSession(Date.parse("2026-09-28T01:00:00Z"))).toBe("overnight"); // Sun 21:00 ET
    expect(marketSession(Date.parse("2026-09-25T23:30:00Z"))).toBe("afterhours"); // Fri 19:30 ET
    expect(marketSession(Date.parse("2026-09-26T00:30:00Z"))).toBe("closed"); // Fri 20:30 ET
  });

  it("treats holidays as closed and honours 1pm early closes", () => {
    expect(marketSession(Date.parse("2026-09-07T15:00:00Z"))).toBe("closed"); // Labor Day
    expect(marketSession(Date.parse("2026-11-27T17:30:00Z"))).toBe("regular"); // 12:30 ET
    expect(marketSession(Date.parse("2026-11-27T18:30:00Z"))).toBe("afterhours"); // 13:30 ET, early close
  });

  it("handles the daylight saving change", () => {
    expect(marketSession(Date.parse("2026-12-01T15:00:00Z"))).toBe("regular"); // 10:00 EST
    expect(marketSession(Date.parse("2026-12-01T14:00:00Z"))).toBe("premarket"); // 9:00 EST
  });
});

describe("holding time", () => {
  it("buckets holding periods and reports averages for winners and losers", () => {
    const { holding } = report([
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: 10, held: 1, day: i })),
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: -10, held: 5, day: i + 6 })),
    ]);

    expect(holding?.trades).toBe(12);
    expect(holding?.winnersAvgMs).toBe(HOUR);
    expect(holding?.losersAvgMs).toBe(5 * HOUR);
    // 1h is not under 1h, so it lands in the "1 to 4h" bucket, and 5h in "4 to 24h".
    expect(holding?.buckets.map((bucket) => bucket.trades)).toEqual([0, 6, 6, 0, 0, 0]);
  });

  it("uses the bucket edges correctly at both extremes", () => {
    const { holding } = report([
      { pnl: 1, held: 0.5, day: 0 },
      { pnl: 1, held: 48, day: 1 },
      { pnl: 1, held: 24 * 10, day: 2 },
      { pnl: 1, held: 4, day: 3 },
      { pnl: 1, held: 24 * 5, day: 4 },
    ]);
    // 30m is under 1h, exactly 4h moves up into "4 to 24h", 2d is "1 to 3d", 5d is "3 to 7d", 10d is over 7d.
    expect(holding?.buckets.map((bucket) => bucket.trades)).toEqual([1, 0, 1, 1, 1, 1]);
  });

  it("flags holding losers longer than winners", () => {
    const { insights } = report([
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: 10, held: 1, day: i })),
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: -10, held: 6, day: i + 6 })),
    ]);
    expect(insights.find((insight) => insight.id === "hold-losers")?.stat).toBe("6.0x");
  });

  it("praises cutting losses faster than winners", () => {
    const { insights } = report([
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: 10, held: 6, day: i })),
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: -10, held: 1, day: i + 6 })),
    ]);
    expect(insights.find((insight) => insight.id === "hold-winners")).toBeDefined();
  });

  it("is absent when open times were not recorded, or there are too few trades", () => {
    expect(report(Array.from({ length: 12 }, (_, i) => ({ pnl: 5, day: i }))).holding).toBeNull();
    expect(report(Array.from({ length: 4 }, (_, i) => ({ pnl: 5, held: 1, day: i }))).holding).toBeNull();
  });
});

describe("risk", () => {
  const varied = [10, 12, 8, 15, 9, 11, 13, 10, -6, 14, 12, 9, 11, 13, 10];

  it("computes annualised Sharpe and Sortino from daily P&L", () => {
    const { risk } = report(varied.map((pnl, day) => ({ pnl, day })));
    expect(risk?.sharpe).toBeGreaterThan(0);
    expect(risk?.sortino).toBeGreaterThan(0);
  });

  it("withholds Sharpe when there are under two weeks of days, too few active days, or no variation", () => {
    const short = report(Array.from({ length: 10 }, (_, i) => ({ pnl: i % 2 ? 5 : -2, day: 0, hour: i })));
    expect(short.risk?.sharpe).toBeNull();
    // A 15 day span, but the wallet only traded on 7 of those days. Mostly zeros would score misleadingly.
    const activeDays = [0, 2, 5, 8, 11, 13, 14];
    const sparse = report(Array.from({ length: 10 }, (_, i) => ({ pnl: i % 2 ? 5 : -2, day: activeDays[i % activeDays.length] })));
    expect(sparse.risk?.sharpe).toBeNull();
    const thirteenDays = report(Array.from({ length: 13 }, (_, day) => ({ pnl: day % 2 ? 5 : -2, day })));
    expect(thirteenDays.risk?.sharpe).toBeNull();
    const flat = report(Array.from({ length: 15 }, (_, day) => ({ pnl: 10, day })));
    expect(flat.risk?.sharpe).toBeNull();
  });

  it("computes the Kelly fraction from win rate and payoff", () => {
    const specs = [...Array.from({ length: 7 }, (_, i) => ({ pnl: 10, day: i })), ...Array.from({ length: 5 }, (_, i) => ({ pnl: -10, day: i + 7 }))];
    const { risk, summary } = report(specs);
    const expected = summary.winRate - (1 - summary.winRate) / (summary.payoffRatio as number);
    expect(risk?.kelly).toBeCloseTo(expected);
    expect(risk?.kelly).toBeCloseTo(7 / 12 - 5 / 12);
  });

  it("times the longest stretch below a peak, and whether it is still under water", () => {
    const recovered = report([
      { pnl: 100, day: 0 }, { pnl: -50, day: 1 }, { pnl: -20, day: 2 }, { pnl: 200, day: 5 },
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: 1, day: 6 + i })),
    ]);
    expect(recovered.risk?.longestDrawdownMs).toBe(5 * DAY);
    expect(recovered.risk?.underwater).toBe(false);

    const stuck = report([{ pnl: 100, day: 0 }, ...Array.from({ length: 11 }, (_, i) => ({ pnl: -5, day: i + 1 }))]);
    expect(stuck.risk?.underwater).toBe(true);
    expect(stuck.risk?.longestDrawdownMs).toBe(11 * DAY);
    expect(stuck.risk?.currentDrawdown).toBe(55);
  });

  it("takes the 5th percentile trade as the 95% value at risk", () => {
    const pnls = Array.from({ length: 20 }, (_, i) => i - 19); // -19 .. 0
    const { risk } = report(pnls.map((pnl, day) => ({ pnl, day })));
    expect(risk?.var95).toBe(-18);
  });

  it("measures the tail as the worst loss over the average loss", () => {
    const { risk } = report([...Array.from({ length: 9 }, (_, i) => ({ pnl: 10, day: i })), ...Array.from({ length: 4 }, (_, i) => ({ pnl: -10, day: i + 9 })), { pnl: -90, day: 13 }]);
    expect(risk?.tailRatio).toBeCloseTo(90 / 26);
  });

  it("finds the hour and the token that cost the most", () => {
    const specs: Spec[] = [
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: 20, day: i, hour: 1, coin: "TSLA" })),
      ...Array.from({ length: 6 }, (_, i) => ({ pnl: -15, day: i + 6, hour: 5, coin: "AMZN" })),
    ];
    const { risk } = report(specs);
    const hour = risk?.whatIfs.find((scenario) => scenario.id === "skip-hour");
    const asset = risk?.whatIfs.find((scenario) => scenario.id === "skip-asset");
    expect(hour?.delta).toBe(90);
    expect(asset?.label).toMatch(/AMZN/);
    expect(asset?.delta).toBe(90);
  });

  it("is absent below ten trades", () => {
    expect(report(Array.from({ length: 9 }, (_, day) => ({ pnl: 5, day }))).risk).toBeNull();
  });
});

describe("stock context", () => {
  const REAL = "0x322F0929c4625eD5bAd873c95208D54E1c003b2d";
  const registry = parseRegistry([
    { tokenSymbol: "TSLA", tokenName: "Tesla • Robinhood Token", status: "ASSET_STATUS_ACTIVE", deployments: [{ contractAddress: REAL, chainId: 4663 }] },
    { tokenSymbol: "OLD", tokenName: "Retired • Robinhood Token", status: "ASSET_STATUS_INACTIVE", deployments: [{ contractAddress: "0xdead", chainId: 4663 }] },
    { tokenSymbol: "ETHTSLA", tokenName: "Elsewhere • Robinhood Token", status: "ASSET_STATUS_ACTIVE", deployments: [{ contractAddress: "0xbeef", chainId: 1 }] },
  ]);

  it("parses the official list into company names and lowercase addresses, skipping inactive and other-chain tokens", () => {
    expect(registry.byAddress.get(REAL.toLowerCase())).toEqual({ symbol: "TSLA", name: "Tesla" });
    expect(registry.byAddress.has("0xdead")).toBe(false);
    expect(registry.byAddress.has("0xbeef")).toBe(false);
  });

  it("identifies stock tokens by contract address, so a counterfeit with the same symbol does not count", () => {
    const { stocks } = report(
      [
        ...Array.from({ length: 5 }, (_, i) => ({ pnl: 10, day: i, coin: "TSLA", assetId: REAL.toLowerCase() })),
        ...Array.from({ length: 5 }, (_, i) => ({ pnl: -10, day: i + 5, coin: "TSLA", assetId: "0xfa4e" })),
      ],
      { registry, match: "address" },
    );
    expect(stocks?.stockTrades).toBe(5);
    expect(stocks?.otherTrades).toBe(5);
    expect(stocks?.tokens[0]).toMatchObject({ symbol: "TSLA", name: "Tesla", trades: 5 });
  });

  it("matches by symbol for sources that carry no addresses", () => {
    const { stocks } = report(Array.from({ length: 5 }, (_, i) => ({ pnl: 10, day: i, coin: "TSLA" })), { registry, match: "symbol" });
    expect(stocks?.stockTrades).toBe(5);
  });

  // Days after Monday 3 Aug 2026 that are ordinary weekdays: Mon to Fri, then the next Monday.
  // Sat 8 Aug would be market closed, so it is skipped on purpose.
  const WEEKDAYS = [0, 1, 2, 3, 4, 7];

  it("groups stock trades by the session they closed in", () => {
    // T0 is 11am ET. Adding 8 hours makes it 7pm ET, which is after hours.
    const { stocks } = report(
      [
        ...WEEKDAYS.map((day) => ({ pnl: 10, day, hour: 0, coin: "TSLA" })),
        ...WEEKDAYS.map((day) => ({ pnl: -10, day, hour: 8, coin: "TSLA" })),
      ],
      { registry, match: "symbol" },
    );
    const bySession = Object.fromEntries((stocks?.sessions ?? []).map((bucket) => [bucket.label, bucket.trades]));
    expect(bySession["Regular hours"]).toBe(6);
    expect(bySession["After hours"]).toBe(6);
  });

  it("flags stock trades that lose money outside regular hours", () => {
    const { insights } = report(
      [
        ...WEEKDAYS.map((day) => ({ pnl: 10, day, hour: 0, coin: "TSLA" })),
        ...WEEKDAYS.map((day) => ({ pnl: -10, day, hour: 8, coin: "TSLA" })),
      ],
      { registry, match: "symbol" },
    );
    expect(insights.find((insight) => insight.id === "stocks-offhours")?.tone).toBe("caution");
  });

  it("is absent when the registry is unavailable or no stock tokens were traded", () => {
    const specs = Array.from({ length: 6 }, (_, i) => ({ pnl: 10, day: i, coin: "PEPE" }));
    expect(report(specs, { registry: null, match: "address" }).stocks).toBeNull();
    expect(report(specs, { registry, match: "symbol" }).stocks).toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [30_000, "under 1m"],
    [12 * 60_000, "12m"],
    [5.24 * HOUR, "5.2h"],
    [30 * HOUR, "30h"],
    [3.4 * DAY, "3.4d"],
    [40 * DAY, "40d"],
  ])("%d ms is %s", (ms, expected) => expect(formatDuration(ms)).toBe(expected));
});
