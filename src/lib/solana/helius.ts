import { SourceError, sleep } from "../robinhood/types";

const API = "https://api.helius.xyz/v0";
const RPC = "https://mainnet.helius-rpc.com/";

const PAGE_SIZE = 100;
/**
 * History is capped. Helius returns 100 transactions per call, newest first,
 * and each call costs credits, so twenty pages keeps a normal wallet complete
 * and a bot wallet bounded.
 */
const MAX_PAGES = 20;
const CALL_GAP_MS = 500;
const ASSET_BATCH = 1000;

// One queue for every Helius call in this process, so two wallets loading at
// once stay inside the free plan's rate limit. Same idea as the Etherscan client.
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + CALL_GAP_MS;
  if (wait) await sleep(wait);
}

export interface TokenBalanceChange {
  userAccount: string;
  tokenAccount: string;
  mint: string;
  rawTokenAmount: { tokenAmount: string; decimals: number };
}

export interface AccountData {
  account: string;
  /** Signed, in lamports. For the fee payer it already includes the fee. */
  nativeBalanceChange: number;
  tokenBalanceChanges?: TokenBalanceChange[];
}

/** The fields NeuroX reads from a Helius enhanced transaction. */
export interface HeliusTransaction {
  signature: string;
  /** Unix seconds. */
  timestamp: number;
  /** Lamports. */
  fee: number;
  feePayer: string;
  transactionError?: unknown;
  accountData?: AccountData[];
}

function apiKey() {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new SourceError("Solana needs a Helius API key. Set HELIUS_API_KEY on the server.");
  return key;
}

async function send(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  await throttle();
  let response: Response;
  try {
    // Not cached by Next: the URL contains the API key. Finished reports are cached in memory instead (see report.ts).
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new SourceError("Could not reach Helius. Check your connection and try again.");
  }
  if (response.status === 429) {
    if (attempt < 2) {
      await sleep(1500);
      return send(url, init, attempt + 1);
    }
    throw new SourceError("Helius is rate limiting requests right now. Try again in a minute.");
  }
  if (response.status === 401 || response.status === 403) throw new SourceError("The Helius API key is missing or invalid.");
  return response;
}

/** Pages through a wallet's transactions, newest first, up to the cap. */
export async function fetchTransactions(address: string): Promise<{ transactions: HeliusTransaction[]; truncated: boolean }> {
  const key = apiKey();
  const transactions: HeliusTransaction[] = [];
  const seen = new Set<string>();
  let before: string | undefined;
  let more = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    // balanceChanged includes activity on the wallet's token accounts, such as tokens
    // received by a swap that never touched the wallet's own account, and filters spam.
    const query = new URLSearchParams({ "api-key": key, limit: String(PAGE_SIZE), "token-accounts": "balanceChanged" });
    if (before) query.set("before-signature", before);

    const response = await send(`${API}/addresses/${address}/transactions?${query}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new SourceError(`Helius could not return this wallet's history (${response.status}).`);

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) throw new SourceError("Helius returned an unexpected response for this wallet.");

    const fresh = (body as HeliusTransaction[]).filter((tx) => tx?.signature && !seen.has(tx.signature));
    for (const tx of fresh) seen.add(tx.signature);
    transactions.push(...fresh);

    // A page with nothing new means the cursor was not honoured, so stop instead of looping.
    more = body.length >= PAGE_SIZE && fresh.length > 0;
    if (!more) break;
    before = body[body.length - 1].signature;
  }

  return { transactions, truncated: more };
}

interface Asset {
  id: string;
  content?: { metadata?: { symbol?: string } };
  token_info?: { symbol?: string };
}

/**
 * Looks up token symbols by mint through Helius' DAS API. Symbols are only
 * labels here (quote assets are matched by mint), so a failure is not fatal:
 * the caller falls back to a shortened mint.
 */
export async function fetchSymbols(mints: string[]): Promise<Map<string, string>> {
  const symbols = new Map<string, string>();
  const key = apiKey();

  for (let start = 0; start < mints.length; start += ASSET_BATCH) {
    const ids = mints.slice(start, start + ASSET_BATCH);
    try {
      const response = await send(`${RPC}?${new URLSearchParams({ "api-key": key })}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "neurox", method: "getAssetBatch", params: { ids } }),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as { result?: (Asset | null)[] };
      for (const asset of body.result ?? []) {
        const symbol = (asset?.token_info?.symbol || asset?.content?.metadata?.symbol || "").trim();
        if (asset?.id && symbol) symbols.set(asset.id, symbol);
      }
    } catch (error) {
      // Rate limits and auth errors from the history call have already surfaced, so labels just degrade here.
      if (!(error instanceof SourceError)) throw error;
    }
  }

  return symbols;
}
