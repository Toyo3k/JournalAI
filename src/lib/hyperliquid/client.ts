import type { AccountSnapshot, Fill } from "../analytics/types";

const ENDPOINT = "https://api.hyperliquid.xyz/info";
const PAGE_SIZE = 2000;
/** The exchange only serves the 10,000 most recent fills per address. */
const MAX_PAGES = 5;
const REVALIDATE_SECONDS = 300;

interface RawFill {
  coin: string;
  px: string;
  sz: string;
  side: "A" | "B";
  time: number;
  dir: string;
  closedPnl: string;
  fee: string;
  oid: number;
  tid: number;
  crossed: boolean;
}

interface RawClearinghouseState {
  marginSummary: { accountValue: string };
  assetPositions: unknown[];
}

export class HyperliquidError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "HyperliquidError";
  }
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch {
    throw new HyperliquidError("Could not reach Hyperliquid. Check your connection and try again.");
  }

  if (response.status === 429) {
    throw new HyperliquidError("Hyperliquid is rate limiting requests right now. Try again in a minute.", 429);
  }
  if (!response.ok) {
    throw new HyperliquidError(`Hyperliquid returned an error (${response.status}).`, response.status);
  }
  return response.json() as Promise<T>;
}

const toFill = (raw: RawFill): Fill => ({
  id: String(raw.tid),
  coin: raw.coin,
  price: Number(raw.px),
  size: Number(raw.sz),
  isBuy: raw.side === "B",
  time: raw.time,
  dir: raw.dir,
  closedPnl: Number(raw.closedPnl),
  fee: Number(raw.fee),
  orderId: raw.oid,
  crossed: raw.crossed,
});

/** Pages forward from the earliest available fill until the history runs out. */
export async function fetchFills(address: string): Promise<{ fills: Fill[]; truncated: boolean }> {
  const seen = new Map<string, Fill>();
  let startTime = 0;
  let lastPageFull = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await post<RawFill[]>({ type: "userFillsByTime", user: address, startTime, aggregateByTime: false });
    for (const raw of batch) seen.set(String(raw.tid), toFill(raw));

    lastPageFull = batch.length >= PAGE_SIZE;
    if (!lastPageFull) break;
    const newest = Math.max(...batch.map((raw) => raw.time));
    if (newest < startTime) break;
    startTime = newest + 1;
  }

  return { fills: [...seen.values()], truncated: lastPageFull };
}

export async function fetchAccount(address: string): Promise<AccountSnapshot | null> {
  try {
    const state = await post<RawClearinghouseState>({ type: "clearinghouseState", user: address });
    return {
      accountValue: Number(state.marginSummary.accountValue),
      openPositions: state.assetPositions.length,
    };
  } catch {
    // The account snapshot is a bonus. A failure here must not sink the report.
    return null;
  }
}
