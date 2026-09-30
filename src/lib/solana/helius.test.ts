import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ME = "7rhxnLV8C77o6d8oz26AgK8x8m5ePsdeRawjqvojbjnQ";
const page = (n: number) => Array.from({ length: 100 }, (_, i) => ({ signature: `sig-${n}-${i}`, timestamp: 0, fee: 0, feePayer: ME }));

beforeEach(() => {
  vi.stubEnv("HELIUS_API_KEY", "key");
  // A fresh module per test, so the shared rate limiter doesn't carry one test's clock into the next.
  vi.resetModules();
});
const load = async () => (await import("./helius")).fetchTransactions;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchTransactions limits", () => {
  it("stops paging once the time budget is spent and marks the history as truncated", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(page(calls++))));
    vi.stubGlobal("fetch", fetchMock);
    // Every clock read moves time on by a second, so a busy wallet's pages "take" several seconds each.
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));

    const fetchTransactions = await load();
    const { transactions, truncated } = await fetchTransactions(ME);
    expect(truncated).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThan(20);
    expect(transactions).toHaveLength(fetchMock.mock.calls.length * 100);
  });

  it("turns a stalled request into an error users can read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
    );
    const fetchTransactions = await load();
    await expect(fetchTransactions(ME)).rejects.toThrow("Helius took too long to respond");
  });
});
