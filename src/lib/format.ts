const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Currency with cents for small values, whole dollars once amounts get large. */
export function formatUsd(value: number, options: { signed?: boolean; compact?: boolean } = {}): string {
  const abs = Math.abs(value);
  const formatter = options.compact && abs >= 10_000 ? usdCompact : abs >= 1_000 ? usdWhole : usd;
  const text = formatter.format(abs);
  if (value < 0) return `-${text}`;
  return options.signed && value > 0 ? `+${text}` : text;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatRatio(value: number | null): string {
  if (value === null) return "n/a";
  return value >= 100 ? ">100" : value.toFixed(2);
}

export const formatDate = (ms: number) => dateFormat.format(ms);
export const formatShortDate = (ms: number) => shortDateFormat.format(ms);
export const formatDateTime = (ms: number) => `${timeFormat.format(ms)} UTC`;

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}
