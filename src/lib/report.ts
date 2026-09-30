import { MAX_WALLETS, chainOf } from "./address";
import type { Chain } from "./address";
import { buildReport } from "./analytics";
import type { Subject, WalletReport } from "./analytics/types";
import { generateDemoFills } from "./demo/generate";
import type { DemoProfile } from "./demo/generate";
import { shortenAddress } from "./format";
import type { StockRegistry } from "./analytics/stocks";
import { loadRobinhood } from "./robinhood";
import { loadStockRegistry } from "./robinhood/stocks";
import { parseRegistry } from "./robinhood/stocks";
import type { SourceData } from "./robinhood/types";
import { SourceError } from "./robinhood/types";
import { loadSolana } from "./solana";

/** Identifiers for the generated sample wallets, usable wherever an address is. */
export const DEMO_IDS = { demo: "active", "demo-2": "steady" } as const satisfies Record<string, DemoProfile>;
export type DemoId = keyof typeof DEMO_IDS;
export const isDemoId = (value: string): value is DemoId => value in DEMO_IDS;

const DEMO_ADDRESSES: Record<DemoId, string> = {
  demo: "0x1234567890abcdef1234567890abcdef12345678",
  "demo-2": "0xabcdef1234567890abcdef1234567890abcdef12",
};

const toSubject = (address: string): Subject => ({ id: address, label: shortenAddress(address), kind: "address" });

const SETUP: Record<Chain, { env: string; title: string; message: string }> = {
  robinhood: {
    env: "ETHERSCAN_API_KEY",
    title: "Robinhood Chain isn't set up yet",
    message: "Add your Etherscan API key as ETHERSCAN_API_KEY in .env.local, then restart the dev server.",
  },
  solana: {
    env: "HELIUS_API_KEY",
    title: "Solana isn't set up yet",
    message: "Add your Helius API key as HELIUS_API_KEY in .env.local, then restart the dev server.",
  },
};

/** What is missing before an address on this chain can be loaded, or null when it is ready. */
export function setupProblem(address: string): { title: string; message: string } | null {
  const chain = chainOf(address);
  if (!chain) return null;
  const { env, ...problem } = SETUP[chain];
  return process.env[env] ? null : problem;
}

/** A wallet's raw history, before it is turned into a report. Shared by single, multi-wallet and fumble views. */
export interface WalletInput {
  address: string;
  chain: Chain;
  data: SourceData;
  stocks?: { registry: StockRegistry | null; match: "address" };
}

async function loadChain(chain: Chain, address: string): Promise<WalletInput> {
  if (chain === "solana") {
    // Robinhood stock tokens are not on Solana, so there is no stock context.
    return { address, chain, data: await loadSolana(address) };
  }
  const [data, registry] = await Promise.all([loadRobinhood(address), loadStockRegistry()]);
  return { address, chain, data, stocks: { registry, match: "address" } };
}

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 50;

/**
 * A small in-memory cache of promises, so requests that arrive together share one load and a
 * failure is never remembered (otherwise a rate limit would stick for the whole TTL).
 */
function promiseCache<T>() {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const cached = entries.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
    const value = load();
    entries.set(key, { at: Date.now(), value });
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    // Oldest first, since Map keeps insertion order.
    while (entries.size > CACHE_MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    return value;
  };
}

const inputs = promiseCache<WalletInput>();
const reports = promiseCache<WalletReport>();

/**
 * A wallet's raw history, cached in memory by address for a few minutes. Loading one can take
 * several seconds and a lot of Etherscan or Helius quota, and a single visit needs it several
 * times (the page, its metadata, its share card and the fumble check).
 *
 * This deliberately avoids Next's fetch cache: it is keyed by URL, and the Etherscan and
 * Helius URLs contain the API key.
 */
export function loadWalletInput(address: string): Promise<WalletInput> {
  const chain = chainOf(address);
  if (!chain) throw new Error("loadWalletInput expects a validated address.");
  return inputs(address, () => loadChain(chain, address));
}

export function loadWalletReport(address: string): Promise<WalletReport> {
  const chain = chainOf(address);
  if (!chain) throw new Error("loadWalletReport expects a validated address.");
  return reports(address, async () => {
    const input = await loadWalletInput(address);
    return buildReport({ subject: toSubject(address), source: input.chain, ...input.data, stocks: input.stocks });
  });
}

export const MAX_PORTFOLIO_WALLETS = MAX_WALLETS;

export interface WalletBreakdown {
  address: string;
  label: string;
  chain: Chain;
  report: WalletReport;
}

export interface PortfolioResult {
  report: WalletReport;
  wallets: WalletBreakdown[];
  /** Wallets that could not be loaded, with a reason safe to show. */
  failed: { address: string; label: string; reason: string }[];
}

/**
 * One combined report across several wallets on any supported chain. A wallet that fails (a bad
 * key, a rate limit, no priceable swaps) is left out with a reason rather than failing the rest.
 * Throws only when no wallet at all could be loaded.
 */
export async function loadPortfolioReport(addresses: string[]): Promise<PortfolioResult> {
  const unique = [...new Set(addresses)].slice(0, MAX_PORTFOLIO_WALLETS);
  if (unique.some((address) => !chainOf(address))) throw new Error("loadPortfolioReport expects validated addresses.");

  const settled = await Promise.allSettled(
    unique.map(async (address) => {
      const problem = setupProblem(address);
      if (problem) throw new SourceError(problem.message);
      return { input: await loadWalletInput(address), report: await loadWalletReport(address) };
    }),
  );

  const wallets: WalletBreakdown[] = [];
  const loaded: WalletInput[] = [];
  const failed: PortfolioResult["failed"] = [];
  settled.forEach((result, i) => {
    const address = unique[i];
    if (result.status === "fulfilled") {
      loaded.push(result.value.input);
      wallets.push({ address, label: shortenAddress(address), chain: result.value.input.chain, report: result.value.report });
    } else {
      // Only errors written for users are shown. Anything else is a bug, so the reason stays generic.
      const reason = result.reason instanceof SourceError ? result.reason.message : "Something went wrong loading this wallet.";
      failed.push({ address, label: shortenAddress(address), reason });
    }
  });

  if (!loaded.length) {
    throw new SourceError(failed.length === 1 ? failed[0].reason : "None of these wallets could be loaded. Check the addresses and try again.");
  }

  // Order ids are prefixed per wallet, so fills from different wallets are never grouped into one trade.
  const fills = loaded.flatMap((input, i) => input.data.fills.map((fill) => ({ ...fill, id: `${i}:${fill.id}`, orderId: `${i}:${fill.orderId}` })));
  const registry = loaded.find((input) => input.stocks)?.stocks ?? null;
  // A note every wallet shares (how trades are rebuilt, say) is shown once. The rest name their wallet.
  const allNotes = loaded.map((input) => input.data.notes ?? []);
  const shared = new Set(allNotes[0].filter((note) => allNotes.every((notes) => notes.includes(note))));
  const notes = [
    ...shared,
    ...loaded.flatMap((input, i) => allNotes[i].filter((note) => !shared.has(note)).map((note) => `${shortenAddress(input.address)}: ${note}`)),
  ];

  const report = buildReport({
    subject: { id: unique.join(","), label: `${loaded.length} wallets`, kind: "portfolio" },
    source: "portfolio",
    fills,
    capabilities: {
      shorts: loaded.some((input) => input.data.capabilities.shorts),
      fees: loaded.every((input) => input.data.capabilities.fees),
    },
    truncated: loaded.some((input) => input.data.truncated),
    notes,
    stocks: registry ?? undefined,
  });

  return { report, wallets, failed };
}

/** The sample wallets trade these four, so they are identified by symbol without a network call. */
const DEMO_STOCKS = parseRegistry([
  { tokenSymbol: "TSLA", tokenName: "Tesla • Robinhood Token", status: "ASSET_STATUS_ACTIVE" },
  { tokenSymbol: "NVDA", tokenName: "NVIDIA • Robinhood Token", status: "ASSET_STATUS_ACTIVE" },
  { tokenSymbol: "AAPL", tokenName: "Apple • Robinhood Token", status: "ASSET_STATUS_ACTIVE" },
  { tokenSymbol: "AMZN", tokenName: "Amazon • Robinhood Token", status: "ASSET_STATUS_ACTIVE" },
]);

export function loadDemoReport(id: DemoId = "demo"): WalletReport {
  return buildReport({
    subject: toSubject(DEMO_ADDRESSES[id]),
    source: "demo",
    fills: generateDemoFills(DEMO_IDS[id]),
    capabilities: { shorts: false, fees: true },
    stocks: { registry: DEMO_STOCKS, match: "symbol" },
  });
}
