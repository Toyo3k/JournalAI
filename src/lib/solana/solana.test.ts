import { afterEach, describe, expect, it, vi } from "vitest";
import { chainOf, isValidAddress, normaliseAddress } from "../address";
import { SourceError } from "../robinhood/types";
import type { HeliusTransaction } from "./helius";
import { WRAPPED_SOL, loadSolana, toTransfers } from "./index";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const ME = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const POOL = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const FEE = 5000;

const token = (mint: string, amount: number, decimals: number, userAccount = ME) => ({
  userAccount,
  tokenAccount: `${userAccount.slice(0, 8)}${mint.slice(0, 8)}`,
  mint,
  rawTokenAmount: { tokenAmount: String(Math.round(amount * 10 ** decimals)), decimals },
});

function tx(signature: string, iso: string, lamports: number, tokens: ReturnType<typeof token>[], extra: Partial<HeliusTransaction> = {}): HeliusTransaction {
  return {
    signature,
    timestamp: Date.parse(iso) / 1000,
    fee: FEE,
    feePayer: ME,
    accountData: [
      // The fee payer's change already includes the fee.
      { account: ME, nativeBalanceChange: lamports - FEE, tokenBalanceChanges: [] },
      { account: "tokenaccounts", nativeBalanceChange: 0, tokenBalanceChanges: tokens },
    ],
    ...extra,
  };
}

describe("address detection", () => {
  it("tells Robinhood Chain and Solana addresses apart by format", () => {
    expect(chainOf("0xFBA7C3E68638FDA0A13994DDB6733CBD016EC826")).toBe("robinhood");
    expect(chainOf(ME)).toBe("solana");
    expect(chainOf("demo")).toBe(null);
    // 0, O, I and l are not base58.
    expect(isValidAddress("0OIl" + ME.slice(4))).toBe(false);
  });

  it("keeps the case of Solana addresses, which is significant", () => {
    expect(normaliseAddress(`  ${ME} `)).toBe(ME);
  });
});

describe("Solana balance changes", () => {
  it("nets wrapped SOL against native SOL and separates the fee", () => {
    // Wrap 1 SOL, swap it for BONK, and close the wrapped account: the only real change is SOL out, BONK in.
    const { transfers, gas } = toTransfers(ME, [
      {
        ...tx("buy", "2026-08-01T00:00:00Z", -1e9, [token(BONK, 1_000_000, 5)]),
        accountData: [
          { account: ME, nativeBalanceChange: -2e9 - FEE, tokenBalanceChanges: [] },
          { account: "wsol", nativeBalanceChange: 0, tokenBalanceChanges: [token(WRAPPED_SOL, 1, 9), token(BONK, 1_000_000, 5)] },
        ],
      },
    ]);

    expect(gas).toEqual([{ hash: "buy", time: Date.parse("2026-08-01T00:00:00Z"), native: FEE / 1e9 }]);
    expect(transfers).toEqual([
      expect.objectContaining({ assetId: "native", symbol: "SOL", amount: 1, direction: "out" }),
      expect.objectContaining({ assetId: BONK, amount: 1_000_000, direction: "in" }),
    ]);
  });

  it("ignores other wallets' changes and keeps only the fee of a failed transaction", () => {
    const { transfers, gas } = toTransfers(ME, [
      tx("other", "2026-08-01T00:00:00Z", 0, [token(BONK, 5, 5, POOL)]),
      tx("failed", "2026-08-01T00:00:00Z", -1e9, [token(BONK, 5, 5)], { transactionError: { InstructionError: [0, "Custom"] } }),
    ]);
    expect(transfers).toEqual([]);
    expect(gas).toHaveLength(2);
  });
});

describe("Solana adapter", () => {
  function stubHelius(pages: HeliusTransaction[][], symbols: Record<string, string> = {}) {
    let page = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("https://api.coingecko.com")) return json({ prices: [[Date.parse("2026-07-01T00:00:00Z"), 150]] });
        if (url.startsWith("https://mainnet.helius-rpc.com")) {
          const { params } = JSON.parse(String(init?.body)) as { params: { ids: string[] } };
          return json({ result: params.ids.map((id) => ({ id, content: { metadata: { symbol: symbols[id] ?? "" } } })) });
        }
        return json(pages[page++] ?? []);
      }),
    );
  }

  it("rebuilds a SOL and a USDC round trip, names tokens and values fees in SOL", async () => {
    vi.stubEnv("HELIUS_API_KEY", "key");
    // Newest first, as Helius returns them.
    stubHelius(
      [
        [
          tx("sell-usdc", "2026-08-04T00:00:00Z", 0, [token(BONK, -500, 5), token(USDC, 60, 6)]),
          tx("buy-usdc", "2026-08-03T00:00:00Z", 0, [token(BONK, 500, 5), token(USDC, -50, 6)]),
          tx("sell-sol", "2026-08-02T00:00:00Z", 1.5e9, [token(BONK, -1000, 5)]),
          tx("buy-sol", "2026-08-01T00:00:00Z", -1e9, [token(BONK, 1000, 5)]),
        ],
      ],
      { [BONK]: "Bonk" },
    );

    const data = await loadSolana(ME);
    const closes = data.fills.filter((fill) => fill.dir === "Close Long");

    // 1 SOL in, 1.5 SOL out at $150 is $75; $50 in, $60 out is $10.
    expect(closes.map((fill) => Math.round(fill.closedPnl))).toEqual([75, 10]);
    expect(closes.every((fill) => fill.coin === "Bonk")).toBe(true);
    expect(closes[0].fee).toBeCloseTo((FEE / 1e9) * 150);
    expect(data.truncated).toBe(false);

    const firstUrl = new URL((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(firstUrl.pathname).toBe(`/v0/addresses/${ME}/transactions`);
    expect(firstUrl.searchParams.get("api-key")).toBe("key");
  });

  it("does not value a counterfeit USDC at $1", async () => {
    vi.stubEnv("HELIUS_API_KEY", "key");
    const FAKE_USDC = "FakeUSDCmint1111111111111111111111111111111";
    stubHelius([[tx("swap", "2026-08-01T00:00:00Z", 0, [token(BONK, 1000, 5), token(FAKE_USDC, -100, 6)])]], { [FAKE_USDC]: "USDC" });

    // It is a token-to-token swap, so it is left out rather than priced. Only the fee remains.
    const data = await loadSolana(ME);
    expect(data.fills.every((fill) => fill.dir === "Gas")).toBe(true);
    expect(data.notes).toContain("1 swap between two non-stable tokens could not be priced and was left out.");
  });

  it("asks for an API key when none is set", async () => {
    vi.stubEnv("HELIUS_API_KEY", "");
    await expect(loadSolana(ME)).rejects.toBeInstanceOf(SourceError);
  });
});
