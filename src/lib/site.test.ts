import { describe, expect, it } from "vitest";
import { officialToken, socialLinks } from "./site";

const MINT = "So11111111111111111111111111111111111111112";
const EVM = "0x2cd357218efcf7edb9f72727213930d0646a4bba";

describe("officialToken", () => {
  it("stays hidden until an address is filled in", () => {
    expect(officialToken({ ticker: "NRX", chain: "solana", address: "" })).toBeNull();
  });

  it("stays hidden when the address doesn't match the chain", () => {
    expect(officialToken({ ticker: "NRX", chain: "solana", address: EVM })).toBeNull();
    expect(officialToken({ ticker: "NRX", chain: "robinhood", address: "0x123" })).toBeNull();
  });

  it("links the token's DexScreener chart on either chain and tidies the ticker", () => {
    expect(officialToken({ ticker: " $NRX ", chain: "solana", address: ` ${MINT} ` })).toEqual({
      ticker: "NRX",
      chain: "solana",
      address: MINT,
      chartUrl: `https://dexscreener.com/solana/${MINT}`,
    });
    expect(officialToken({ ticker: "", chain: "robinhood", address: EVM })?.chartUrl).toBe(`https://dexscreener.com/robinhood/${EVM}`);
  });
});

describe("socialLinks", () => {
  it("keeps only real https links and labels them", () => {
    expect(
      socialLinks([
        { kind: "x", href: "https://x.com/neurox" },
        { kind: "telegram", href: "" },
        { kind: "discord", href: "javascript:alert(1)" },
        { kind: "website", href: "http://neurox.example" },
      ]),
    ).toEqual([{ kind: "x", href: "https://x.com/neurox", label: "X" }]);
  });
});
