import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Fill } from "./analytics/types";
import { loadPortfolioReport, loadWalletReport } from "./report";
import { loadRobinhood } from "./robinhood";
import { SourceError } from "./robinhood/types";
import { loadSolana } from "./solana";

vi.mock("./robinhood", () => ({ loadRobinhood: vi.fn() }));
vi.mock("./robinhood/stocks", async (original) => ({ ...(await original<object>()), loadStockRegistry: vi.fn(async () => null) }));
vi.mock("./solana", () => ({ loadSolana: vi.fn() }));

const empty = { fills: [], capabilities: { shorts: false, fees: true } };
const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

beforeEach(() => {
  vi.mocked(loadRobinhood).mockReset();
  vi.mocked(loadSolana).mockReset();
});

describe("loadWalletReport cache", () => {
  it("loads a wallet once and shares the result, even between simultaneous requests", async () => {
    vi.mocked(loadRobinhood).mockResolvedValue(empty);

    const [a, b] = await Promise.all([loadWalletReport(address(1)), loadWalletReport(address(1))]);
    await loadWalletReport(address(1));

    expect(loadRobinhood).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("keeps wallets separate", async () => {
    vi.mocked(loadRobinhood).mockResolvedValue(empty);
    await loadWalletReport(address(2));
    await loadWalletReport(address(3));
    expect(loadRobinhood).toHaveBeenCalledTimes(2);
  });

  it("does not remember a failure, so a rate limit clears on the next visit", async () => {
    vi.mocked(loadRobinhood).mockRejectedValueOnce(new Error("rate limited")).mockResolvedValueOnce(empty);

    await expect(loadWalletReport(address(4))).rejects.toThrow("rate limited");
    await expect(loadWalletReport(address(4))).resolves.toBeDefined();
    expect(loadRobinhood).toHaveBeenCalledTimes(2);
  });

  it("rejects an address that was not validated first", () => {
    expect(() => loadWalletReport("nope")).toThrow(/validated/);
  });
});

describe("loadPortfolioReport", () => {
  const SOL = "So11111111111111111111111111111111111111112";
  const T = Date.UTC(2026, 5, 1);
  // Both wallets reuse the same order ids, the way two unrelated wallets could, so without a
  // per-wallet prefix their sells would group into one trade.
  const roundTrip = (pnl: number): Fill[] => [
    { id: "a", coin: "CAT", price: 1, size: 100, isBuy: true, time: T, dir: "Open Long", closedPnl: 0, fee: 0, orderId: "same" },
    { id: "b", coin: "CAT", price: 1 + pnl / 100, size: 100, isBuy: false, time: T + 60_000, dir: "Close Long", closedPnl: pnl, fee: 0, orderId: "same2" },
  ];
  const data = (fills: Fill[]) => ({ fills, capabilities: { shorts: false, fees: true } });

  beforeEach(() => {
    vi.stubEnv("ETHERSCAN_API_KEY", "test");
    vi.stubEnv("HELIUS_API_KEY", "test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("combines wallets across chains without merging their trades", async () => {
    vi.mocked(loadRobinhood).mockResolvedValue(data(roundTrip(10)));
    vi.mocked(loadSolana).mockResolvedValue(data(roundTrip(-4)));

    const { report, wallets, failed } = await loadPortfolioReport([address(20), SOL]);
    expect(wallets.map((wallet) => wallet.chain)).toEqual(["robinhood", "solana"]);
    expect(failed).toEqual([]);
    expect(report.source).toBe("portfolio");
    expect(report.subject.kind).toBe("portfolio");
    expect(report.summary.tradeCount).toBe(2);
    expect(report.summary.netPnl).toBeCloseTo(6);
  });

  it("shows notes every wallet shares once and names the wallet on the rest", async () => {
    vi.mocked(loadRobinhood).mockImplementation(async (wallet) => ({
      ...data(roundTrip(1)),
      notes: ["How trades are rebuilt.", ...(wallet === address(26) ? ["4 sales had no earlier purchase."] : [])],
    }));
    const { report } = await loadPortfolioReport([address(26), address(27)]);
    expect(report.notes).toEqual(["How trades are rebuilt.", "0x0000…001a: 4 sales had no earlier purchase."]);
  });

  it("leaves out a wallet that fails, with a reason safe to show", async () => {
    vi.mocked(loadRobinhood).mockImplementation(async (wallet) => {
      if (wallet === address(22)) throw new SourceError("Etherscan is rate limiting us.");
      if (wallet === address(23)) throw new Error("internal detail");
      return data(roundTrip(5));
    });

    const { wallets, failed } = await loadPortfolioReport([address(21), address(22), address(23)]);
    expect(wallets).toHaveLength(1);
    expect(failed.map((wallet) => wallet.reason)).toEqual(["Etherscan is rate limiting us.", "Something went wrong loading this wallet."]);
  });

  it("throws a readable error when no wallet loads", async () => {
    vi.mocked(loadRobinhood).mockRejectedValue(new SourceError("Etherscan is down."));
    await expect(loadPortfolioReport([address(24), address(25)])).rejects.toThrow(/None of these wallets/);
  });
});
