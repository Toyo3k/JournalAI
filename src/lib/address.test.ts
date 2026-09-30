import { describe, expect, it } from "vitest";
import { chainOf, parseAddressList, reportHref } from "./address";

const EVM = "0x2cd357218efcf7edb9f72727213930d0646a4bba";
const SOL = "So11111111111111111111111111111111111111112";

describe("chainOf", () => {
  it("tells the chains apart by format", () => {
    expect(chainOf(EVM)).toBe("robinhood");
    expect(chainOf(SOL)).toBe("solana");
    expect(chainOf("hello")).toBeNull();
  });
});

describe("parseAddressList", () => {
  it("splits on commas, semicolons, spaces and new lines, across chains", () => {
    expect(parseAddressList(`${EVM},${SOL}\n  nope;`)).toEqual([
      { value: EVM, chain: "robinhood" },
      { value: SOL, chain: "solana" },
      { value: "nope", chain: null },
    ]);
  });

  it("drops duplicates after normalising, so case differences on EVM addresses don't count twice", () => {
    expect(parseAddressList(`${EVM} ${EVM.toUpperCase().replace("0X", "0x")}`)).toEqual([{ value: EVM, chain: "robinhood" }]);
  });

  it("keeps Solana addresses case-sensitive", () => {
    const lower = SOL.toLowerCase();
    expect(parseAddressList(`${SOL} ${lower}`).map((entry) => entry.value)).toEqual([SOL, lower]);
  });
});

describe("reportHref", () => {
  it("sends one wallet to its own report and several to a combined one", () => {
    expect(reportHref([EVM])).toBe(`/wallet/${EVM}`);
    expect(reportHref([EVM, SOL])).toBe(`/portfolio?w=${EVM}&w=${SOL}`);
  });
});
