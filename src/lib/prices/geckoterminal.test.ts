import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimited, fetchCandles, lookupTokens, resetLimiter } from "./geckoterminal";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const urlOf = (call: unknown[]) => new URL(String(call[0]));

beforeEach(() => {
  resetLimiter();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("COINGECKO_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const token = (address: string, pool: string | null, price: string | null) => ({
  attributes: { address, price_usd: price },
  relationships: { top_pools: { data: pool ? [{ id: pool }] : [] } },
});

describe("lookupTokens", () => {
  it("strips the network prefix from pool ids and lowercases Robinhood addresses", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [token("0xAbC", "robinhood_0xPOOL", "0.5"), token("0xDef", null, null)] }));
    const markets = await lookupTokens("robinhood", ["0xabc", "0xdef"]);
    expect(markets.get("0xabc")).toEqual({ pool: "0xPOOL", priceUsd: 0.5 });
    expect(markets.get("0xdef")).toEqual({ pool: null, priceUsd: null });
    expect(urlOf(fetchMock.mock.calls[0]).pathname).toBe("/api/v2/networks/robinhood/tokens/multi/0xabc,0xdef");
  });

  it("looks tokens up in batches of 30 and caches the answer", async () => {
    fetchMock.mockImplementation(async () => json({ data: [] }));
    const mints = Array.from({ length: 31 }, (_, i) => `Mint${i}`);
    await lookupTokens("solana", mints);
    await lookupTokens("solana", mints);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchMock.mock.calls[1]).pathname.endsWith("/Mint30")).toBe(true);
  });

  it("uses CoinGecko's keyed API when a key is set", async () => {
    vi.stubEnv("COINGECKO_API_KEY", "test-key");
    fetchMock.mockResolvedValueOnce(json({ data: [] }));
    await lookupTokens("solana", ["Mint"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.coingecko\.com\/api\/v3\/onchain\/networks\/solana\/tokens\/multi\/Mint/);
    expect(init.headers["x-cg-demo-api-key"]).toBe("test-key");
  });

  it("backs off after a 429 instead of retrying", async () => {
    fetchMock.mockResolvedValue(json({}, 429));
    await expect(lookupTokens("solana", ["A"])).rejects.toBeInstanceOf(RateLimited);
    await expect(lookupTokens("solana", ["B"])).rejects.toBeInstanceOf(RateLimited);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchCandles", () => {
  const rows = [
    [1_700_000_200, 1, 3, 0.5, 2, 10],
    [1_700_000_100, 1, 1.5, 0.9, 1, 10],
  ];

  it("uses hourly candles for recent sales and returns them oldest first in ms", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { attributes: { ohlcv_list: rows } } }));
    const candles = await fetchCandles("solana", "POOL", "MINT", Date.now() - 86_400_000);
    const url = urlOf(fetchMock.mock.calls[0]);
    expect(url.pathname).toBe("/api/v2/networks/solana/pools/POOL/ohlcv/hour");
    expect(url.searchParams.get("token")).toBe("MINT");
    expect(candles).toEqual([
      { t: 1_700_000_100_000, high: 1.5, close: 1 },
      { t: 1_700_000_200_000, high: 3, close: 2 },
    ]);
  });

  it("uses daily candles for sales older than the hourly reach", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { attributes: { ohlcv_list: [] } } }));
    await fetchCandles("robinhood", "0xpool", "0xtoken", Date.now() - 90 * 86_400_000);
    expect(urlOf(fetchMock.mock.calls[0]).pathname).toBe("/api/v2/networks/robinhood/pools/0xpool/ohlcv/day");
  });

  it("treats an unknown pool as no history", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404));
    await expect(fetchCandles("solana", "GONE", "MINT", Date.now())).resolves.toEqual([]);
  });
});
