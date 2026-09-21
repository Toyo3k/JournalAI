import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWalletReport } from "./report";
import { loadRobinhood } from "./robinhood";

vi.mock("./robinhood", () => ({ loadRobinhood: vi.fn() }));

const empty = { fills: [], capabilities: { shorts: false, fees: true } };
const address = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

beforeEach(() => vi.mocked(loadRobinhood).mockReset());

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
