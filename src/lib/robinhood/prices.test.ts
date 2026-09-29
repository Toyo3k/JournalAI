import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUsdHistory } from "./prices";
import { SourceError } from "./types";

const DAY = 86_400_000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("fetchUsdHistory", () => {
  it("clamps a request that reaches further back than CoinGecko's public 365-day window", async () => {
    const fetchMock = vi.fn(async (_url: string) => json({ prices: [[Date.now(), 100]] }));
    vi.stubGlobal("fetch", fetchMock);

    const fourHundredDaysAgo = Date.now() - 400 * DAY;
    await fetchUsdHistory("ethereum", "ETH", fourHundredDaysAgo, Date.now());

    const requested = new URL(fetchMock.mock.calls[0][0] as string);
    const fromMs = Number(requested.searchParams.get("from")) * 1000;
    const daysBack = (Date.now() - fromMs) / DAY;
    // Comfortably inside the 365-day limit, not clamped to the exact boundary.
    expect(daysBack).toBeLessThan(365);
    expect(daysBack).toBeGreaterThan(300);
  });

  it("does not touch the request window when the wallet's history is already recent", async () => {
    const fetchMock = vi.fn(async (_url: string) => json({ prices: [[Date.now(), 100]] }));
    vi.stubGlobal("fetch", fetchMock);

    const tenDaysAgo = Date.now() - 10 * DAY;
    await fetchUsdHistory("ethereum", "ETH", tenDaysAgo, Date.now());

    const requested = new URL(fetchMock.mock.calls[0][0] as string);
    const fromMs = Number(requested.searchParams.get("from")) * 1000;
    // Allowing for the function's own day-boundary rounding (it also subtracts a day of padding).
    expect(Math.abs(fromMs - tenDaysAgo)).toBeLessThan(2 * DAY);
  });

  it("turns the real CoinGecko response for an out-of-range request into a readable error if it still occurs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(
          {
            error: {
              status: {
                error_code: 10012,
                error_message: "Your request exceeds the allowed time range. Public API users are limited to querying historical data within the past 365 days.",
              },
            },
          },
          401,
        ),
      ),
    );
    await expect(fetchUsdHistory("solana", "SOL", Date.now() - 400 * DAY, Date.now())).rejects.toThrow(/SOL price service returned an error \(401\)/);
    await expect(fetchUsdHistory("solana", "SOL", Date.now() - 400 * DAY, Date.now())).rejects.toBeInstanceOf(SourceError);
  });

  it("gives a specific message when the price API is rate limiting requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 429)));
    await expect(fetchUsdHistory("ethereum", "ETH", Date.now() - DAY, Date.now())).rejects.toThrow(/rate limiting/);
  });

  it("rejects an empty price list rather than silently returning no prices", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ prices: [] })));
    await expect(fetchUsdHistory("ethereum", "ETH", Date.now() - DAY, Date.now())).rejects.toThrow(/No ETH price data/);
  });

  it("wraps a network failure in a readable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(fetchUsdHistory("ethereum", "ETH", Date.now() - DAY, Date.now())).rejects.toThrow(/Could not fetch ETH prices/);
  });
});
