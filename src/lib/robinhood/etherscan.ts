import { SourceError, sleep } from "./types";

const BASE = "https://api.etherscan.io/v2/api";
export const ROBINHOOD_CHAIN_ID = 4663;

const PAGE_SIZE = 1000;
/** Etherscan serves at most 10,000 rows per query window (page x offset). */
const PAGES_PER_WINDOW = 10;
const MAX_WINDOWS = 3;
const CALL_GAP_MS = 250;

export type Row = Record<string, string>;
export type EtherscanAction = "txlist" | "txlistinternal" | "tokentx";

async function request(params: Record<string, string>, attempt = 0): Promise<Row[]> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new SourceError("Robinhood Chain needs an Etherscan API key. Set ETHERSCAN_API_KEY on the server.");

  const query = new URLSearchParams({ chainid: String(ROBINHOOD_CHAIN_ID), module: "account", apikey: key, ...params });
  let response: Response;
  try {
    response = await fetch(`${BASE}?${query}`, { next: { revalidate: 300 } });
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

/** Pages through every row for one action, oldest first, moving the start block when a window fills. */
export async function fetchAll(action: EtherscanAction, address: string): Promise<{ rows: Row[]; truncated: boolean }> {
  let rows: Row[] = [];
  let startblock = 0;
  let truncated = false;

  for (let window = 0; window < MAX_WINDOWS; window++) {
    const batch: Row[] = [];
    let lastPageFull = false;

    for (let page = 1; page <= PAGES_PER_WINDOW; page++) {
      if (window > 0 || page > 1) await sleep(CALL_GAP_MS);
      const result = await request({
        action,
        address,
        startblock: String(startblock),
        endblock: "99999999999",
        page: String(page),
        offset: String(PAGE_SIZE),
        sort: "asc",
      });
      batch.push(...result);
      lastPageFull = result.length >= PAGE_SIZE;
      if (!lastPageFull) break;
    }

    // A new window restarts at the last block seen, so drop that block's rows first to avoid duplicates.
    if (window > 0) rows = rows.filter((row) => row.blockNumber !== String(startblock));
    rows.push(...batch);

    if (!lastPageFull) return { rows, truncated: false };
    startblock = Number(batch[batch.length - 1].blockNumber);
    truncated = true;
  }

  return { rows, truncated };
}
