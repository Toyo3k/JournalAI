import type { ClosedTrade, DayCell, Fill, HourCell, TradePoint, Visuals } from "./types";

const DAY = 86_400_000;
/** More points than this and the chart becomes a smear, so very active wallets are thinned. */
export const MAX_SERIES_POINTS = 600;
/** Beyond a year the calendar cells get too small to read, so it shows the most recent 52 weeks. */
const MAX_CALENDAR_DAYS = 52 * 7;

const dayOf = (ms: number) => Math.floor(ms / DAY) * DAY;
/** Monday on or before the given UTC day. */
const mondayOf = (day: number) => day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;

/**
 * Keeps an even spread of points plus the ones that matter: the last (it carries the final
 * total) and the deepest drawdown (so the chart never looks shallower than the headline).
 */
export function thinSeries(series: TradePoint[], max = MAX_SERIES_POINTS): TradePoint[] {
  if (series.length <= max) return series;
  const keep = new Set<number>([series.length - 1]);
  let deepest = 0;
  series.forEach((point, i) => {
    if (point.drawdown < series[deepest].drawdown) deepest = i;
  });
  keep.add(deepest);
  const step = (series.length - 1) / (max - 3);
  for (let i = 0; i * step < series.length - 1; i++) keep.add(Math.round(i * step));
  return [...keep].sort((a, b) => a - b).map((i) => series[i]);
}

/**
 * Chart data for the report. Every fill counts toward the running total, opening fees
 * included, so the equity line ends exactly on net P&L and the calendar sums to it too.
 * `fills` must be sorted by time.
 */
export function buildVisuals(fills: Fill[], trades: ClosedTrade[]): Visuals | null {
  if (!trades.length) return null;

  const tradeByKey = new Map(trades.map((trade) => [trade.id, trade]));
  const recorded = new Set<string>();
  const byDay = new Map<number, DayCell>();
  const series: TradePoint[] = [];
  let running = 0;
  let peak = 0;

  for (const fill of fills) {
    const net = fill.closedPnl - fill.fee;
    running += net;
    peak = Math.max(peak, running);

    const day = dayOf(fill.time);
    const cell = byDay.get(day) ?? { t: day, pnl: 0, trades: 0 };
    cell.pnl += net;
    byDay.set(day, cell);

    // A trade is recorded once, when its last closing fill lands.
    const key = `${fill.coin}:${fill.orderId}`;
    const trade = tradeByKey.get(key);
    if (trade && fill.time === trade.closedAt && !recorded.has(key)) {
      recorded.add(key);
      cell.trades += 1;
      series.push({ t: trade.closedAt, v: running, pnl: trade.pnl, coin: trade.coin, drawdown: running - peak });
    }
  }

  // Fees paid after the last trade (gas for a later buy or an approval) still count toward net P&L,
  // so a final point carries them and the curve ends exactly on the headline.
  const last = series[series.length - 1];
  if (last && Math.abs(running - last.v) >= 0.005) {
    series.push({ t: fills[fills.length - 1].time, v: running, pnl: running - last.v, coin: "Fees", drawdown: running - peak });
  }

  const firstDay = dayOf(fills[0].time);
  const lastDay = dayOf(fills[fills.length - 1].time);
  const clipped = lastDay - firstDay >= MAX_CALENDAR_DAYS * DAY;
  const start = mondayOf(clipped ? lastDay - (MAX_CALENDAR_DAYS - 1) * DAY : firstDay);
  const calendar: DayCell[] = [];
  for (let day = start; day <= lastDay; day += DAY) calendar.push(byDay.get(day) ?? { t: day, pnl: 0, trades: 0 });

  const hourWeekday: HourCell[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ pnl: 0, trades: 0 })));
  for (const trade of trades) {
    const date = new Date(trade.closedAt);
    const cell = hourWeekday[(date.getUTCDay() + 6) % 7][date.getUTCHours()];
    cell.pnl += trade.pnl;
    cell.trades += 1;
  }

  return { series: thinSeries(series), calendar, calendarClipped: clipped, hourWeekday };
}
