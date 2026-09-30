import type { DayCell, HourCell } from "@/lib/analytics/types";
import { formatShortDate, formatUsd } from "@/lib/format";
import styles from "./charts.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
/** How far past natural size a heatmap may stretch to fill its panel. */
const MAX_SCALE = 1.35;
/** Beyond this many weeks the calendar needs a full-width panel to stay readable. */
export const WIDE_CALENDAR_WEEKS = 26;

/** Diverging fill for a P&L cell: green for profit, red for loss, stronger with size. */
export function pnlFill(pnl: number, maxAbs: number, trades: number): string {
  if (!trades && !pnl) return "var(--surface-2)";
  if (pnl === 0 || maxAbs === 0) return "var(--surface-3)";
  const alpha = 0.22 + Math.min(1, Math.abs(pnl) / maxAbs) * 0.78;
  return pnl > 0 ? `rgb(47 224 164 / ${alpha.toFixed(2)})` : `rgb(255 107 122 / ${alpha.toFixed(2)})`;
}

const tradeCount = (trades: number) => (trades ? `${trades} ${trades === 1 ? "trade" : "trades"}` : "");

/**
 * With `tips`, cells carry `data-tip="Title|value|detail"` for the client TipLayer instead of
 * a native <title>, which would otherwise show a second, slower tooltip.
 */
export function CalendarHeatmap({ days, cell = 14, gap = 3, tips = false }: { days: DayCell[]; cell?: number; gap?: number; tips?: boolean }) {
  const weeks = Math.ceil(days.length / 7);
  const left = 30;
  const top = 16;
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.pnl)));
  const width = left + weeks * (cell + gap);
  const height = top + 7 * (cell + gap);
  const monthStarts = days.filter((day, i) => i % 7 === 0 && new Date(day.t).getUTCDate() <= 7);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.chart}
      // Never scale much past natural size, or a short history turns into giant squares.
      style={{ maxWidth: width * MAX_SCALE }}
      role="img"
      aria-label={`Daily profit and loss from ${formatShortDate(days[0].t)} to ${formatShortDate(days[days.length - 1].t)}`}
    >
      {[0, 2, 4].map((row) => (
        <text key={row} x={0} y={top + row * (cell + gap) + cell - 3} className={styles.axisLabel}>{WEEKDAYS[row]}</text>
      ))}
      {monthStarts.map((day) => (
        <text key={day.t} x={left + Math.floor(days.indexOf(day) / 7) * (cell + gap)} y={11} className={styles.axisLabel}>{monthFormat.format(day.t)}</text>
      ))}
      {days.map((day, i) => {
        const value = day.trades || day.pnl ? formatUsd(day.pnl, { signed: true }) : "No trades";
        return (
          <rect
            key={day.t}
            x={left + Math.floor(i / 7) * (cell + gap)}
            y={top + (i % 7) * (cell + gap)}
            width={cell}
            height={cell}
            rx={3}
            fill={pnlFill(day.pnl, maxAbs, day.trades)}
            data-tip={tips ? `${WEEKDAYS[i % 7]}, ${formatShortDate(day.t)}|${value}|${tradeCount(day.trades)}` : undefined}
          >
            {tips ? null : <title>{`${formatShortDate(day.t)}: ${value}${day.trades ? `, ${tradeCount(day.trades)}` : ""}`}</title>}
          </rect>
        );
      })}
    </svg>
  );
}

export function HourWeekdayHeatmap({ grid, cell = 16, gap = 2, tips = false }: { grid: HourCell[][]; cell?: number; gap?: number; tips?: boolean }) {
  const left = 30;
  const top = 4;
  const bottom = 16;
  const maxAbs = Math.max(...grid.flat().map((slot) => Math.abs(slot.pnl)));
  const width = left + 24 * (cell + gap);
  const height = top + 7 * (cell + gap) + bottom;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} style={{ maxWidth: width * MAX_SCALE }} role="img" aria-label="Net profit and loss by hour of day and weekday, in UTC">
      {grid.map((row, d) => (
        <g key={d}>
          <text x={0} y={top + d * (cell + gap) + cell - 4} className={styles.axisLabel}>{WEEKDAYS[d]}</text>
          {row.map((slot, h) => {
            const label = `${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 UTC`;
            const value = slot.trades ? formatUsd(slot.pnl, { signed: true }) : "No trades";
            return (
              <rect
                key={h}
                x={left + h * (cell + gap)}
                y={top + d * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                fill={pnlFill(slot.pnl, maxAbs, slot.trades)}
                data-tip={tips ? `${label}|${value}|${tradeCount(slot.trades)}` : undefined}
              >
                {tips ? null : <title>{`${label}: ${value}`}</title>}
              </rect>
            );
          })}
        </g>
      ))}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={left + h * (cell + gap)} y={height - 3} className={styles.axisLabel}>{String(h).padStart(2, "0")}</text>
      ))}
    </svg>
  );
}
