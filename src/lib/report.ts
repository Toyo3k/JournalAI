import { buildReport } from "./analytics";
import type { WalletReport } from "./analytics";
import { generateDemoFills } from "./demo/generate";
import { fetchAccount, fetchFills } from "./hyperliquid/client";

export const DEMO_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

export async function loadWalletReport(address: string): Promise<WalletReport> {
  const [{ fills, truncated }, account] = await Promise.all([fetchFills(address), fetchAccount(address)]);
  return buildReport({ address, source: "hyperliquid", fills, truncated, account });
}

export function loadDemoReport(): WalletReport {
  return buildReport({
    address: DEMO_ADDRESS,
    source: "demo",
    fills: generateDemoFills(),
    account: { accountValue: 48_250, openPositions: 2 },
  });
}
