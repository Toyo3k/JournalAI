import type { Chain } from "../address";
import { sleep } from "../robinhood/types";

/**
 * Token prices from GeckoTerminal's on-chain data: covers Robinhood Chain and Solana DEX pools,
 * including the memecoins and launches that CoinGecko proper doesn't list.
 *
 * With COINGECKO_API_KEY set (a free demo key works) calls go through CoinGecko's keyed copy of
 * the same API at 30 a minute. Without one they use GeckoTerminal's public API, which in practice
 * allows only about 5 a minute, so fewer tokens are checked. Every call goes through one limiter.
 */

const PUBLIC_BASE = "https://api.geckoterminal.com/api/v2";
const KEYED_BASE = "https://api.coingecko.com/api/v3/onchain";
const NETWORKS: Record<Chain, string> = { robinhood: "robinhood", solana: "solana" };
/** The multi-token endpoint takes up to 30 addresses per call. */
const BATCH = 30;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** Hourly candles, 1,000 at most per call, reach about 41 days back. Older sales use daily candles. */
export const HOURLY_REACH_MS = 40 * DAY;
/** Never queue a call for longer than this. Past it the caller gets RateLimited and shows what it has. */
const MAX_WAIT_MS = 8_000;
/** After a 429, back off entirely for a while: refused calls count against the quota too. */
const COOLDOWN_MS = 30_000;

/** Whether calls go through the keyed CoinGecko API, with its higher rate limit. */
export const hasPriceKey = () => Boolean(process.env.COINGECKO_API_KEY);

export interface Candle {
  /** Start of the candle, ms. */
  t: number;
  high: number;
  close: number;
}

export interface TokenMarket {
  /** The token's most liquid pool, or null when it isn't traded on any pool GeckoTerminal knows. */
  pool: string | null;
  priceUsd: number | null;
}

/** Thrown when the price service is out of calls for now, so callers can say "try again shortly". */
export class RateLimited extends Error {}

// A token bucket shared by every request in this process. Null until first use, so the
// capacity follows whether a key is set.
let tokens: number | null = null;
let refilledAt = 0;
let cooldownUntil = 0;

function limits() {
  return hasPriceKey() ? { capacity: 10, perMinute: 28 } : { capacity: 5, perMinute: 5 };
}

async function takeToken() {
  const { capacity, perMinute } = limits();
  const refillMs = 60_000 / perMinute;
  if (tokens === null) {
    tokens = capacity;
    refilledAt = Date.now();
  }
  const now = Date.now();
  if (now < cooldownUntil) throw new RateLimited("The price service is busy.");
  tokens = Math.min(capacity, tokens + (now - refilledAt) / refillMs);
  refilledAt = now;
  if (tokens >= 1) {
    tokens -= 1;
    return;
  }
  const wait = Math.ceil((1 - tokens) * refillMs);
  if (wait > MAX_WAIT_MS) throw new RateLimited("The price service is busy.");
  // Reserve the call now (the bucket goes negative), so callers queued behind this one wait longer.
  tokens -= 1;
  await sleep(wait);
}

/** Resets the limiter and cache. Tests only. */
export function resetLimiter() {
  tokens = null;
  cooldownUntil = 0;
  cache.clear();
}

async function get(path: string): Promise<unknown> {
  await takeToken();
  const key = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { accept: "application/json" };
  if (key) headers["x-cg-demo-api-key"] = key;
  // no-store: Next's fetch cache would log the URL, and the header carries the key.
  const response = await fetch(`${key ? KEYED_BASE : PUBLIC_BASE}${path}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (response.status === 429) {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    throw new RateLimited("The price service is busy.");
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Price service returned ${response.status}`);
  return response.json();
}

// Small TTL cache: pools change rarely, prices and candles often.
const cache = new Map<string, { until: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { until: Date.now() + ttlMs, value });
  if (cache.size > 2_000) cache.delete(cache.keys().next().value!);
  return value;
}

interface MultiResponse {
  data?: { attributes?: { address?: string; price_usd?: string | null }; relationships?: { top_pools?: { data?: { id?: string }[] } } }[];
}

/** The top pool and current USD price for each token, looked up in batches of 30. */
export async function lookupTokens(chain: Chain, addresses: string[]): Promise<Map<string, TokenMarket>> {
  const network = NETWORKS[chain];
  const out = new Map<string, TokenMarket>();
  const unique = [...new Set(addresses)];

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const key = `tokens:${network}:${batch.join(",")}`;
    const body = await cached(key, 10 * 60_000, async () => (await get(`/networks/${network}/tokens/multi/${batch.join(",")}?include=top_pools`)) as MultiResponse | null);
    for (const token of body?.data ?? []) {
      const address = token.attributes?.address;
      if (!address) continue;
      // Pool ids look like "solana_<address>", so strip the network prefix.
      const poolId = token.relationships?.top_pools?.data?.[0]?.id ?? null;
      const price = Number(token.attributes?.price_usd);
      const market = { pool: poolId ? poolId.slice(poolId.indexOf("_") + 1) : null, priceUsd: Number.isFinite(price) && price > 0 ? price : null };
      // Robinhood addresses come back checksummed, so match case-insensitively there.
      out.set(chain === "robinhood" ? address.toLowerCase() : address, market);
    }
  }
  return out;
}

interface OhlcvResponse {
  data?: { attributes?: { ohlcv_list?: number[][] } };
}

/**
 * Price candles for one token in its pool, oldest first. Hourly when the history needed is
 * recent, daily otherwise. Prices are for `token`, whichever side of the pool it sits on.
 */
export async function fetchCandles(chain: Chain, pool: string, token: string, since: number): Promise<Candle[]> {
  const network = NETWORKS[chain];
  const hourly = Date.now() - since <= HOURLY_REACH_MS;
  const timeframe = hourly ? "hour" : "day";
  const key = `ohlcv:${network}:${pool}:${token}:${timeframe}`;
  // Daily candles barely change within a few hours. Hourly ones gain one candle an hour.
  const body = await cached(key, hourly ? 15 * 60_000 : 6 * HOUR, async () =>
    (await get(`/networks/${network}/pools/${pool}/ohlcv/${timeframe}?aggregate=1&limit=1000&currency=usd&token=${token}`)) as OhlcvResponse | null,
  );
  const list = body?.data?.attributes?.ohlcv_list ?? [];
  return list
    .map(([t, , high, , close]) => ({ t: t * 1000, high, close }))
    .filter((candle) => Number.isFinite(candle.high) && candle.high > 0)
    .sort((a, b) => a.t - b.t);
}

export const CANDLE_MS = { hour: HOUR, day: DAY };
