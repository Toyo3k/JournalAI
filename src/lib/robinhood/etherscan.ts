import { SourceError, sleep } from "./types";

const BASE = "https://api.etherscan.io/v2/api";
export const ROBINHOOD_CHAIN_ID = 4663;

const PAGE_SIZE = 1000;
/**
 * History is capped per data type. Etherscan rows can be huge (a transaction
 * row carries its full calldata, often 15KB), so an unbounded load of a busy
 * wallet takes a minute and hundreds of megabytes. Three pages keeps a normal
 * wallet complete and a bot wallet bounded.
 */
const MAX_PAGES = 3;
const CALL_GAP_MS = 250;

// Every Etherscan call in this process goes through one queue, so two wallets
// loading at once (a comparison, or a page plus its share card) stay inside
// the free tier's rate limit instead of each pacing itself separately.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + CALL_GAP_MS;
  if (wait) await sleep(wait);
}

export type Row = Record<string, string>;
export type EtherscanAction = "txlist" | "txlistinternal" | "tokentx";

async function request(params: Record<string, string>, attempt = 0): Promise<Row[]> {
  await throttle();
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new SourceError("Robinhood Chain needs an Etherscan API key. Set ETHERSCAN_API_KEY on the server.");

  const query = new URLSearchParams({ chainid: String(ROBINHOOD_CHAIN_ID), module: "account", apikey: key, ...params });
  let response: Response;
  try {
    // Not cached by Next: responses can exceed its 2MB limit, and its cache logs the full URL, API key included.
    // Finished reports are cached in memory by address instead (see report.ts).
    response = await fetch(`${BASE}?${query}`, { cache: "no-store" });
  } catch {
    throw new SourceError("Could not reach Etherscan. Check your connection and try again.");
  }
  if (!response.ok) throw new SourceError(`Etherscan returned an error (${response.status}).`);

  const body = (await response.json()) as { status?: string; message?: string; result?: unknown };
  if (Array.isArray(body.result)) return body.result as Row[];

  // Errors arrive as HTTP 200 with a string in `result`.
  const detail = typeof body.result === "string" ? body.result : (body.message ?? "");
  if (/rate limit/i.test(detail)) {
    if (attempt < 2) {
      await sleep(1200);
      return request(params, attempt + 1);
    }
    throw new SourceError("Etherscan is rate limiting requests right now. Try again in a minute.");
  }
  if (/api key/i.test(detail)) throw new SourceError("The Etherscan API key is missing or invalid.");
  if (/no (transactions|records) found/i.test(detail)) return [];
  throw new SourceError(`Etherscan could not return this wallet's history: ${detail || "unknown error"}.`);
}

/** Pages through one action's rows, oldest first, up to the cap. */
export async function fetchAll(action: EtherscanAction, address: string): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = [];
  let full = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await request({
      action,
      address,
      startblock: "0",
      endblock: "99999999999",
      page: String(page),
      offset: String(PAGE_SIZE),
      sort: "asc",
    });
    rows.push(...batch);
    full = batch.length >= PAGE_SIZE;
    if (!full) break;
  }

  return { rows, truncated: full };
}
