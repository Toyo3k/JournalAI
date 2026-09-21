import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidAddress, normaliseAddress } from "../address";
import { loadRobinhood } from "./index";
import { SourceError } from "./types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("address helpers", () => {
  it("accepts well-formed addresses in any case and rejects the rest", () => {
    expect(isValidAddress("0xFBA7C3E68638FDA0A13994DDB6733CBD016EC826")).toBe(true);
    expect(isValidAddress("0x123")).toBe(false);
    expect(isValidAddress("fba7c3e68638fda0a13994ddb6733cbd016ec826")).toBe(false);
  });

  it("lowercases and trims so URLs and cache keys are stable", () => {
    expect(normaliseAddress("  0xABCDEF0123456789ABCDEF0123456789ABCDEF01 ")).toBe("0xabcdef0123456789abcdef0123456789abcdef01");
  });
});

describe("Robinhood Chain adapter", () => {
  const me = "0x00000000000000000000000000000000000000aa";
  const router = "0x00000000000000000000000000000000000000bb";
  const t = (iso: string) => String(Date.parse(iso) / 1000);
  const ok = (result: unknown[]) => json({ status: result.length ? "1" : "0", message: result.length ? "OK" : "No transactions found", result });

  function stubEtherscan(handlers: Record<string, unknown[]>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("https://api.coingecko.com")) {
          return json({ prices: [[Date.parse("2026-07-01T00:00:00Z"), 2000]] });
        }
        return ok(handlers[new URL(url).searchParams.get("action") ?? ""] ?? []);
      }),
    );
  }

  it("rebuilds a round trip from raw Etherscan rows and sends the right query", async () => {
    vi.stubEnv("ETHERSCAN_API_KEY", "key");
    stubEtherscan({
      txlist: [
        { hash: "0x1", from: me, to: router, value: "0", isError: "0", timeStamp: t("2026-08-01T00:00:00Z"), gasUsed: "100000", gasPrice: "1000000000", blockNumber: "1" },
        { hash: "0x2", from: me, to: router, value: "0", isError: "0", timeStamp: t("2026-08-02T00:00:00Z"), gasUsed: "100000", gasPrice: "1000000000", blockNumber: "2" },
      ],
      tokentx: [
        { hash: "0x1", from: me, to: router, contractAddress: "0xusdc", tokenSymbol: "USDC", tokenDecimal: "6", value: "1000000000", timeStamp: t("2026-08-01T00:00:00Z"), blockNumber: "1" },
        { hash: "0x1", from: router, to: me, contractAddress: "0xaapl", tokenSymbol: "AAPL", tokenDecimal: "18", value: "10000000000000000000", timeStamp: t("2026-08-01T00:00:00Z"), blockNumber: "1" },
        { hash: "0x2", from: me, to: router, contractAddress: "0xaapl", tokenSymbol: "AAPL", tokenDecimal: "18", value: "10000000000000000000", timeStamp: t("2026-08-02T00:00:00Z"), blockNumber: "2" },
        { hash: "0x2", from: router, to: me, contractAddress: "0xusdc", tokenSymbol: "USDC", tokenDecimal: "6", value: "1200000000", timeStamp: t("2026-08-02T00:00:00Z"), blockNumber: "2" },
      ],
    });

    const data = await loadRobinhood(me);

    const close = data.fills.find((fill) => fill.dir === "Close Long");
    expect(close?.closedPnl).toBeCloseTo(200);
    // 100,000 gas at 1 gwei is 0.0001 ETH, valued at $2,000.
    expect(close?.fee).toBeCloseTo(0.2);
    expect(data.capabilities).toEqual({ shorts: false, fees: true });
    expect(data.truncated).toBe(false);

    const firstUrl = new URL((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(firstUrl.searchParams.get("chainid")).toBe("4663");
    expect(firstUrl.searchParams.get("apikey")).toBe("key");
  });

  it("values native ETH legs from internal transactions", async () => {
    vi.stubEnv("ETHERSCAN_API_KEY", "key");
    stubEtherscan({
      txlist: [{ hash: "0x1", from: me, to: router, value: "1000000000000000000", isError: "0", timeStamp: t("2026-08-01T00:00:00Z"), gasUsed: "0", gasPrice: "0", blockNumber: "1" }],
      txlistinternal: [{ hash: "0x2", from: router, to: me, value: "1500000000000000000", isError: "0", timeStamp: t("2026-08-02T00:00:00Z"), blockNumber: "2" }],
      tokentx: [
        { hash: "0x1", from: router, to: me, contractAddress: "0xtsla", tokenSymbol: "TSLA", tokenDecimal: "18", value: "8000000000000000000", timeStamp: t("2026-08-01T00:00:00Z"), blockNumber: "1" },
        { hash: "0x2", from: me, to: router, contractAddress: "0xtsla", tokenSymbol: "TSLA", tokenDecimal: "18", value: "8000000000000000000", timeStamp: t("2026-08-02T00:00:00Z"), blockNumber: "2" },
      ],
    });

    const data = await loadRobinhood(me);

    // Bought with 1 ETH ($2,000), sold for 1.5 ETH ($3,000) at the same flat price.
    expect(data.fills.find((fill) => fill.dir === "Close Long")?.closedPnl).toBeCloseTo(1000);
  });

  it("returns an empty history for a wallet with no activity", async () => {
    vi.stubEnv("ETHERSCAN_API_KEY", "key");
    stubEtherscan({});
    expect((await loadRobinhood(me)).fills).toEqual([]);
  });

  it("turns Etherscan's string errors into readable ones", async () => {
    vi.stubEnv("ETHERSCAN_API_KEY", "bad");
    // A fresh Response per call, because a body can only be read once.
    vi.stubGlobal("fetch", vi.fn(async () => json({ status: "0", message: "NOTOK", result: "Invalid API Key" })));
    await expect(loadRobinhood(me)).rejects.toThrow(/missing or invalid/);
    await expect(loadRobinhood(me)).rejects.toBeInstanceOf(SourceError);
  });

  it("refuses to run without a key", async () => {
    vi.stubEnv("ETHERSCAN_API_KEY", "");
    await expect(loadRobinhood(me)).rejects.toThrow(/ETHERSCAN_API_KEY/);
  });
});
