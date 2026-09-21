/**
 * US equity market sessions, in New York time. Robinhood stock tokens follow a
 * 24/5 schedule: trading opens Sunday 8pm and closes Friday 8pm Eastern, with
 * a regular session inside it. Outside that, the underlying market is closed
 * and token prices can only drift until it reopens.
 */

export type Session = "regular" | "premarket" | "afterhours" | "overnight" | "closed";

export const SESSION_ORDER: Session[] = ["regular", "premarket", "afterhours", "overnight", "closed"];

export const SESSION_LABELS: Record<Session, string> = {
  regular: "Regular hours",
  premarket: "Pre-market",
  afterhours: "After hours",
  overnight: "Overnight",
  closed: "Market closed",
};

export const SESSION_HINTS: Record<Session, string> = {
  regular: "9:30am to 4pm ET, when the underlying stock trades with the most liquidity.",
  premarket: "4am to 9:30am ET.",
  afterhours: "4pm to 8pm ET.",
  overnight: "8pm to 4am ET, on the 24/5 schedule.",
  closed: "Weekends and US market holidays, when the underlying stock is not trading.",
};

/**
 * NYSE holidays, as YYYY-MM-DD. Outside the years listed only weekends are
 * recognised, so the list needs extending each year.
 */
const HOLIDAYS = new Set([
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** Days the regular session ends at 1pm. */
const EARLY_CLOSE = new Set(["2025-07-03", "2025-11-28", "2025-12-24", "2026-11-27", "2026-12-24", "2027-11-26"]);

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function marketSession(ms: number): Session {
  const parts = Object.fromEntries(formatter.formatToParts(ms).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = WEEKDAYS.indexOf(parts.weekday);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);

  const OVERNIGHT_START = 20 * 60;
  // The week runs from Sunday 8pm to Friday 8pm, so Sunday evening is open and Friday evening is not.
  if (weekday === 6) return "closed";
  if (weekday === 0) return minute >= OVERNIGHT_START ? "overnight" : "closed";
  if (weekday === 5 && minute >= OVERNIGHT_START) return "closed";
  if (HOLIDAYS.has(date)) return "closed";

  const close = EARLY_CLOSE.has(date) ? 13 * 60 : 16 * 60;
  if (minute >= 9 * 60 + 30 && minute < close) return "regular";
  if (minute >= 4 * 60 && minute < 9 * 60 + 30) return "premarket";
  if (minute >= close && minute < OVERNIGHT_START) return "afterhours";
  return "overnight";
}
