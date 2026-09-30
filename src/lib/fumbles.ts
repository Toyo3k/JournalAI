import type { Chain } from "./address";
import { analyseFumbles, pickTokens, salesFrom } from "./analytics/fumbles";
import type { FumbleReport, PriceHistory, PricePoint, Sale } from "./analytics/fumbles";
import { generateDemoFills } from "./demo/generate";
import { RateLimited, fetchCandles, hasPriceKey, lookupTokens } from "./prices/geckoterminal";
import { DEMO_IDS, loadWalletInput } from "./report";
import type { DemoId, WalletInput } from "./report";

/**
 * How many tokens are checked, biggest sales first. Each costs one price-history call, so without
 * a CoinGecko key (about 5 calls a minute) only a handful fit in one burst.
 */
/** The fumble section gives up waiting on prices after this and shows what it has. */
const PRICE_DEADLINE_MS = 15_000;

export const fumbleTokenLimit = () => (hasPriceKey() ? 12 : 4);

export interface FumbleResult {
  report: FumbleReport;
  /** Explains a partial or empty check, for example when the price service was busy. */
  notes: string[];
  sample?: boolean;
}

const splitKey = (key: string) => {
  const at = key.indexOf(":");
  return { chain: key.slice(0, at) as Chain, assetId: key.slice(at + 1) };
};

/**
 * Checks what the tokens these wallets sold did afterwards. The wallets' histories come from the
 * same cache as the report, so this only adds the price calls. It never throws for a price
 * problem: whatever could be checked is returned, with a note about the rest.
 */
export async function loadFumbles(addresses: string[]): Promise<FumbleResult> {
  const settled = await Promise.allSettled(addresses.map(loadWalletInput));
  const inputs = settled.filter((entry): entry is PromiseFulfilledResult<WalletInput> => entry.status === "fulfilled").map((entry) => entry.value);
  const sales = inputs.flatMap((input) => salesFrom(input.data.fills, input.chain));
  const { keys, unchecked } = pickTokens(sales, fumbleTokenLimit());
  const notes: string[] = [];

  // One batched lookup per chain for each token's pool and price.
  const byChain = new Map<Chain, string[]>();
  for (const key of keys) {
    const { chain, assetId } = splitKey(key);
    byChain.set(chain, [...(byChain.get(chain) ?? []), assetId]);
  }

  const firstSale = new Map<string, number>();
  for (const sale of sales) firstSale.set(sale.key, Math.min(firstSale.get(sale.key) ?? Infinity, sale.time));

  // Filled in as prices arrive, so whatever is ready at the deadline can still be shown.
  const histories = new Map<string, PriceHistory>();
  const priceAll = async () => {
    const markets = new Map<string, Awaited<ReturnType<typeof lookupTokens>>>();
    for (const [chain, assetIds] of byChain) markets.set(chain, await lookupTokens(chain, assetIds));
    return Promise.allSettled(
      keys.map(async (key) => {
        const { chain, assetId } = splitKey(key);
        const market = markets.get(chain)?.get(assetId);
        if (!market?.pool) return;
        const candles = await fetchCandles(chain, market.pool, assetId, firstSale.get(key)!);
        const current = market.priceUsd ?? candles.at(-1)?.close;
        if (current && candles.length) histories.set(key, { candles, current });
      }),
    );
  };

  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"late">((resolve) => {
    timer = setTimeout(() => resolve("late"), PRICE_DEADLINE_MS);
  });
  try {
    // Show whatever was priced by the deadline rather than keep the section loading.
    const results = await Promise.race([priceAll(), deadline]);
    if (results === "late") {
      busy = true;
    } else {
      busy = results.some((result) => result.status === "rejected" && result.reason instanceof RateLimited);
      const failed = results.find((result) => result.status === "rejected" && !(result.reason instanceof RateLimited));
      if (failed?.status === "rejected") console.error("Fumble price history failed", failed.reason);
    }
  } catch (error) {
    if (!(error instanceof RateLimited)) console.error("Fumble token lookup failed", error);
    busy = error instanceof RateLimited;
    if (!busy) notes.push("We couldn't reach the price service, so the fumble check is unavailable right now.");
  } finally {
    clearTimeout(timer);
  }

  const report = analyseFumbles(sales, histories, unchecked);
  if (busy) {
    notes.push(
      report.checked
        ? "The price service is busy, so some tokens weren't checked. Reload in a minute to fill them in."
        : "The price service is busy right now. Reload in a minute to see what the tokens you sold did next.",
    );
  }
  if (settled.length > inputs.length) notes.push("Some wallets couldn't be loaded, so their sales aren't included.");
  return { report, notes };
}

/** Deterministic PRNG, so the sample fumbles are the same on every render. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How each sample stock moved over the window: a rally to fumble, a slide to escape, a round trip.
const DEMO_TRENDS: Record<string, { drift: number; bump: number; seed: number }> = {
  TSLA: { drift: 0.05, bump: 0.04, seed: 11 },
  NVDA: { drift: 0.02, bump: 0.05, seed: 23 },
  AAPL: { drift: -0.02, bump: 0.02, seed: 5 },
  AMZN: { drift: -0.09, bump: 0.01, seed: 17 },
};
const DEMO_END = Date.UTC(2026, 8, 1);
const HOUR = 3_600_000;

/** A generated price history for each sample stock, around the prices the sample wallet traded at. */
function demoHistory(sales: Sale[], end: number): PriceHistory {
  const trend = DEMO_TRENDS[sales[0].coin] ?? { drift: 0, bump: 0.05, seed: 1 };
  const random = mulberry32(trend.seed);
  const start = Math.min(...sales.map((sale) => sale.time)) - 24 * HOUR;
  const base = sales.reduce((sum, sale) => sum + sale.price, 0) / sales.length;
  const hours = Math.ceil((end - start) / HOUR);
  const candles: PricePoint[] = [];
  let noise = 0;
  for (let i = 0; i <= hours; i++) {
    const progress = i / hours;
    noise = noise * 0.97 + (random() - 0.5) * 0.006;
    // A drift over the window plus one hump, so there is a clear peak to point at.
    const level = 1 + trend.drift * progress + trend.bump * Math.sin(Math.PI * Math.min(1, progress * 1.4)) + noise;
    const close = base * level;
    candles.push({ t: start + i * HOUR, high: close * (1 + random() * 0.006), close });
  }
  return { candles, current: candles.at(-1)!.close };
}

/** Fumbles for the sample wallets, from generated price histories. Clearly labelled as sample data. */
export function loadDemoFumbles(id: DemoId = "demo"): FumbleResult {
  const fills = generateDemoFills(DEMO_IDS[id], DEMO_END).map((fill) => ({ ...fill, assetId: fill.coin }));
  const sales = salesFrom(fills, "demo");
  const histories = new Map<string, PriceHistory>();
  for (const key of new Set(sales.map((sale) => sale.key))) {
    histories.set(key, demoHistory(sales.filter((sale) => sale.key === key), DEMO_END));
  }
  return { report: analyseFumbles(sales, histories, 0, DEMO_END), notes: [], sample: true };
}
