import { isValidAddress } from "./address";
import { buildReport } from "./analytics";
import type { Subject, WalletReport } from "./analytics/types";
import { generateDemoFills } from "./demo/generate";
import type { DemoProfile } from "./demo/generate";
import { shortenAddress } from "./format";
import { loadRobinhood } from "./robinhood";
import { loadStockRegistry } from "./robinhood/stocks";
import { parseRegistry } from "./robinhood/stocks";

/** Identifiers for the generated sample wallets, usable wherever an address is. */
export const DEMO_IDS = { demo: "active", "demo-2": "steady" } as const satisfies Record<string, DemoProfile>;
export type DemoId = keyof typeof DEMO_IDS;
export const isDemoId = (value: string): value is DemoId => value in DEMO_IDS;

const DEMO_ADDRESSES: Record<DemoId, string> = {
  demo: "0x1234567890abcdef1234567890abcdef12345678",
  "demo-2": "0xabcdef1234567890abcdef1234567890abcdef12",
};

const toSubject = (address: string): Subject => ({ id: address, label: shortenAddress(address), kind: "address" });

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 50;
const reports = new Map<string, { at: number; report: Promise<WalletReport> }>();

/**
 * Reports are cached in memory by address for a few minutes. Loading one can
 * take several seconds and a lot of Etherscan quota, and a single visit asks
 * for it more than once (the page, its metadata and its share card). Storing
 * the promise also shares one load between requests that arrive together.
 *
 * This deliberately avoids Next's fetch cache: it is keyed by URL, and the
 * Etherscan URL contains the API key.
 */
export function loadWalletReport(address: string): Promise<WalletReport> {
  if (!isValidAddress(address)) throw new Error("loadWalletReport expects a validated address.");

  const cached = reports.get(address);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.report;

  const report = Promise.all([loadRobinhood(address), loadStockRegistry()]).then(([data, registry]) =>
    buildReport({ subject: toSubject(address), source: "robinhood", ...data, stocks: { registry, match: "address" } }),
  );
  reports.set(address, { at: Date.now(), report });
  // A failure must not be remembered, or a rate limit would stick for the whole TTL.
  report.catch(() => {
    if (reports.get(address)?.report === report) reports.delete(address);
  });

  // Oldest first, since Map keeps insertion order.
  while (reports.size > CACHE_MAX_ENTRIES) reports.delete(reports.keys().next().value!);
  return report;
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
