import { ImageResponse } from "next/og";
import { BrandCard, CARD_SIZE, ReportCard } from "@/components/share/report-card";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import { shortenAddress } from "@/lib/format";
import { loadWalletReport } from "@/lib/report";

export const alt = "A JournalAI wallet report";
export const size = CARD_SIZE;
export const contentType = "image/png";

const HEADERS = { "cache-control": "public, max-age=300, s-maxage=300" };

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const address = normaliseAddress(raw);

  // A share card must always render something, so any failure falls back to a branded card.
  if (isValidAddress(address) && process.env.ETHERSCAN_API_KEY) {
    try {
      const report = await loadWalletReport(address);
      if (report.summary.fillCount > 0) return new ImageResponse(<ReportCard report={report} />, { ...size, headers: HEADERS });
    } catch {
      // Falls through to the brand card below.
    }
  }

  const label = isValidAddress(address) ? shortenAddress(address) : "a wallet";
  return new ImageResponse(<BrandCard title="Wallet trading report" subtitle={`${label}. Win rate, gas costs, drawdown and the habits behind them.`} />, size);
}
