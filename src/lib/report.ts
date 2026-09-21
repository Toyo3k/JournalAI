import { isValidAddress } from "./address";
import { buildReport } from "./analytics";
import type { Subject, WalletReport } from "./analytics/types";
import { generateDemoFills } from "./demo/generate";
import { shortenAddress } from "./format";
import { loadRobinhood } from "./robinhood";

export const DEMO_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

const toSubject = (address: string): Subject => ({ id: address, label: shortenAddress(address), kind: "address" });

export async function loadWalletReport(address: string): Promise<WalletReport> {
  if (!isValidAddress(address)) throw new Error("loadWalletReport expects a validated address.");
  const data = await loadRobinhood(address);
  return buildReport({ subject: toSubject(address), source: "robinhood", ...data });
}

export function loadDemoReport(): WalletReport {
  return buildReport({
    subject: toSubject(DEMO_ADDRESS),
    source: "demo",
    fills: generateDemoFills(),
    capabilities: { shorts: false, fees: true },
  });
}
