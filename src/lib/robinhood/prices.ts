import { SourceError } from "./types";

export type PricePoint = [timestampMs: number, price: number];

/** Looks up the most recent known price at or before a moment in time. */
export function makePriceLookup(points: PricePoint[]): (ms: number) => number {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  return (ms) => {
    if (!sorted.length) return 0;
    let low = 0;
    let high = sorted.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (sorted[mid][0] <= ms) low = mid;
      else high = mid - 1;
    }
    return sorted[low][1];
  };
}

const ONE_DAY_MS = 86_400_000;
const ONE_HOUR_MS = 3_600_000;
/**
 * CoinGecko's public tier rejects `market_chart/range` requests reaching further back than 365 days
 * (a 401 with error_code 10012, "exceeds the allowed time range"). Requests are clamped to 350 days as
 * a safety margin, since a hard failure here would otherwise abort the whole report for an old wallet.
 */
const MAX_HISTORY_DAYS = 350;

/**
 * USD price history from CoinGecko. One range request covers the whole wallet
 * lifetime, and ranges over 90 days come back at daily resolution. Transfers
 * carry no prices, so this is what turns native coin legs into dollars.
 */
export async function fetchUsdHistory(coinId: string, symbol: string, fromMs: number, toMs: number): Promise<(ms: number) => number> {
  // Swaps older than the clamp are priced at the oldest point this request still returns
  // (makePriceLookup falls back to its earliest point for anything before it) rather than
  // failing the whole report over one API-tier limit.
  const earliestAllowedMs = Date.now() - MAX_HISTORY_DAYS * ONE_DAY_MS;
  const clampedFromMs = Math.max(fromMs, earliestAllowedMs);

  // The window is rounded to whole days and hours so the request URL repeats
  // and Next's fetch cache can serve it, instead of hitting the rate-limited
  // price API with a unique URL on every report.
  const from = Math.floor(Math.floor((clampedFromMs - ONE_DAY_MS) / ONE_DAY_MS) * (ONE_DAY_MS / 1000));
  const to = Math.ceil(toMs / ONE_HOUR_MS) * (ONE_HOUR_MS / 1000);
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;

  let response: Response;
  try {
    response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
      { headers, next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000) },
    );
  } catch {
    // Includes a timeout: a stalled price call would otherwise keep the page loading forever.
    throw new SourceError(`Could not fetch ${symbol} prices needed to value this wallet's swaps.`);
  }
  if (response.status === 429) {
    throw new SourceError(`The ${symbol} price service is rate limiting requests. Try again in a minute.`);
  }
  if (!response.ok) throw new SourceError(`${symbol} price service returned an error (${response.status}).`);

  const body = (await response.json()) as { prices?: PricePoint[] };
  if (!Array.isArray(body.prices) || !body.prices.length) {
    throw new SourceError(`No ${symbol} price data was available for this wallet's time range.`);
  }
  return makePriceLookup(body.prices);
}

export const fetchEthUsd = (fromMs: number, toMs: number) => fetchUsdHistory("ethereum", "ETH", fromMs, toMs);
export const fetchSolUsd = (fromMs: number, toMs: number) => fetchUsdHistory("solana", "SOL", fromMs, toMs);
