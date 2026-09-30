import { describe, expect, it } from "vitest";
import { generateDemoFills } from "../demo/generate";
import { buildReport } from "./index";
import type { Fill, Insight, TradePoint } from "./types";
import { SCORE_MIN_TRADES, buildScore, buildVerdict } from "./verdict";
import { MAX_SERIES_POINTS, thinSeries } from "./visuals";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 7, 3, 15); // Monday 3 Aug 2026

const report = (fills: Fill[]) =>
  buildReport({ subject: { id: "x", label: "x", kind: "address" }, source: "demo", fills, capabilities: { shorts: false, fees: true } });

/** An opening fill that only pays a fee, then a closing fill that realizes P&L. */
function roundTrip(i: number, pnl: number, day: number, openFee = 1, closeFee = 1): Fill[] {
  const closeAt = T0 + day * DAY;
  return [
    { id: `o${i}`, coin: "TSLA", price: 100, size: 1, isBuy: true, time: closeAt - 3_600_000, dir: "Open Long", closedPnl: 0, fee: openFee, orderId: `open${i}` },
    { id: `c${i}`, coin: "TSLA", price: 100, size: 1, isBuy: false, time: closeAt, dir: "Close Long", closedPnl: pnl, fee: closeFee, orderId: `close${i}`, openedAt: closeAt - 3_600_000 },
  ];
}

const cents = (value: number) => Math.round(value * 100);

describe("buildVisuals", () => {
  it("ends the equity series exactly on net P&L, opening fees included", () => {
    const { summary, visuals } = report(generateDemoFills("active"));
    expect(cents(visuals!.series.at(-1)!.v)).toBe(cents(summary.netPnl));
  });

  it("still ends on net P&L when fees are paid after the last trade", () => {
    // A trade, then an opening fill whose fee lands after it: seen on a real wallet as a 7 cent gap.
    const later: Fill = { id: "late", coin: "NVDA", price: 100, size: 1, isBuy: true, time: T0 + 5 * DAY, dir: "Open Long", closedPnl: 0, fee: 0.07, orderId: "late" };
    const { summary, visuals } = report([...roundTrip(1, 50, 0), later]);
    const last = visuals!.series.at(-1)!;
    expect(cents(last.v)).toBe(cents(summary.netPnl));
    expect(last.coin).toBe("Fees");
    expect(cents(last.pnl)).toBe(-7);
  });

  it("adds no fee point when nothing was paid after the last trade", () => {
    const { visuals } = report(roundTrip(1, 50, 0));
    expect(visuals!.series.map((point) => point.coin)).toEqual(["TSLA"]);
  });

  it("makes the calendar sum to net P&L", () => {
    const { summary, visuals } = report(generateDemoFills("steady"));
    expect(visuals!.calendarClipped).toBe(false);
    expect(cents(visuals!.calendar.reduce((total, day) => total + day.pnl, 0))).toBe(cents(summary.netPnl));
  });

  it("counts each closed trade once in the calendar and in the series", () => {
    const { summary, visuals } = report(generateDemoFills("active"));
    expect(visuals!.calendar.reduce((total, day) => total + day.trades, 0)).toBe(summary.tradeCount);
    expect(visuals!.series).toHaveLength(summary.tradeCount);
  });

  it("keeps drawdown at or below zero, and at zero on a new high", () => {
    const { visuals } = report([...roundTrip(1, 50, 0), ...roundTrip(2, -30, 1), ...roundTrip(3, 100, 2)]);
    const drawdowns = visuals!.series.map((point) => point.drawdown);
    expect(drawdowns.every((value) => value <= 0)).toBe(true);
    expect(drawdowns[0]).toBe(0);
    expect(drawdowns[1]).toBe(-32);
    expect(drawdowns[2]).toBe(0);
  });

  it("starts the calendar on a Monday and uses UTC days", () => {
    const { visuals } = report(roundTrip(1, 10, 2)); // Wednesday
    expect(new Date(visuals!.calendar[0].t).getUTCDay()).toBe(1);
    expect(visuals!.calendar.every((day) => day.t % DAY === 0)).toBe(true);
  });

  it("clips the calendar to the last 52 weeks of a longer history", () => {
    const { visuals } = report([...roundTrip(1, 10, 0), ...roundTrip(2, 10, 500)]);
    expect(visuals!.calendarClipped).toBe(true);
    expect(visuals!.calendar.length).toBeLessThanOrEqual(52 * 7 + 6);
  });

  it("buckets the hour grid by UTC hour, Monday first", () => {
    const { visuals } = report(roundTrip(1, 10, 0)); // Monday 15:00 UTC
    expect(visuals!.hourWeekday[0][15]).toEqual({ pnl: 9, trades: 1 });
  });

  it("is null when there are no closed trades", () => {
    expect(report([]).visuals).toBeNull();
  });
});

describe("thinSeries", () => {
  const series: TradePoint[] = Array.from({ length: 2000 }, (_, i) => ({ t: i, v: i, pnl: 1, coin: "X", drawdown: i === 1234 ? -500 : 0 }));

  it("caps the number of points", () => {
    expect(thinSeries(series).length).toBeLessThanOrEqual(MAX_SERIES_POINTS);
  });

  it("always keeps the final point and the deepest drawdown", () => {
    const thinned = thinSeries(series);
    expect(thinned.at(-1)).toBe(series.at(-1));
    expect(thinned.some((point) => point.drawdown === -500)).toBe(true);
  });

  it("stays in time order", () => {
    const times = thinSeries(series).map((point) => point.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("leaves short series untouched", () => {
    expect(thinSeries(series.slice(0, 10))).toHaveLength(10);
  });
});

const caution = (id: string, title = ""): Insight => ({ id, tone: "caution", title, body: "" });

describe("buildVerdict", () => {
  const { summary } = report(generateDemoFills("active"));

  it("leads with the result and names up to two habits", () => {
    const verdict = buildVerdict(summary, [caution("size-after-loss"), caution("worst-asset", "AAPL is your biggest leak"), caution("loss-streak")]);
    expect(verdict).toBe("Profitable with a real edge, but you size up after losses and AAPL keeps leaking money.");
  });

  it("says so when a profitable wallet has no leaks", () => {
    expect(buildVerdict(summary, [])).toMatch(/no clear leaks/);
  });

  it("calls out a losing wallet, naming the habits as the cause", () => {
    const losing = report([...roundTrip(1, -50, 0), ...roundTrip(2, -20, 1)]).summary;
    expect(buildVerdict(losing, [])).toBe("Losing money overall.");
    expect(buildVerdict(losing, [caution("loss-size")])).toBe("Losing money overall, mainly because your losses run bigger than your wins.");
  });

  it("phrases a barely profitable wallet without a double 'but'", () => {
    // Profit factor just over 1: 30 gross profit against 26 gross loss.
    const thin = report([...roundTrip(1, 32, 0), ...roundTrip(2, -12, 1), ...roundTrip(3, -12, 2)]).summary;
    const verdict = buildVerdict(thin, [caution("fee-drag")]);
    expect(verdict).toBe("Only just profitable: fees eat into your gains.");
    expect(verdict.match(/\bbut\b/g)).toBeNull();
  });

  it("never uses em dashes", () => {
    expect(buildVerdict(summary, [caution("size-after-loss"), caution("hold-losers")])).not.toMatch(/\u2014/);
  });
});

describe("buildScore", () => {
  it("stays between 0 and 100 with whole-number parts", () => {
    const { summary, risk, insights } = report(generateDemoFills("active"));
    const score = buildScore(summary, risk, insights)!;
    expect(score.value).toBeGreaterThanOrEqual(0);
    expect(score.value).toBeLessThanOrEqual(100);
    expect(score.parts.every((part) => Number.isInteger(part.value) && part.value >= 0 && part.value <= 100)).toBe(true);
  });

  it("flags a small sample as low confidence", () => {
    const small = report(roundTrip(1, 10, 0));
    expect(small.score!.lowConfidence).toBe(true);
    expect(report(generateDemoFills("active")).summary.tradeCount).toBeGreaterThanOrEqual(SCORE_MIN_TRADES);
    expect(report(generateDemoFills("active")).score!.lowConfidence).toBe(false);
  });

  it("penalises sizing up after losses", () => {
    const { summary, risk } = report(generateDemoFills("active"));
    const calm = buildScore(summary, risk, [])!.parts.find((part) => part.key === "discipline")!.value;
    const tilted = buildScore(summary, risk, [caution("size-after-loss")])!.parts.find((part) => part.key === "discipline")!.value;
    expect(calm - tilted).toBe(30);
  });

  it("is null without trades", () => {
    expect(report([]).score).toBeNull();
  });
});
