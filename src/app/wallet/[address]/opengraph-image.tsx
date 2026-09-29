import { ImageResponse } from "next/og";
import { BrandCard, CARD_SIZE, ReportCard, loadMark } from "@/components/share/report-card";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import { shortenAddress } from "@/lib/format";
import { loadWalletReport, setupProblem } from "@/lib/report";

export const alt = "A NeuroX wallet report";
export const size = CARD_SIZE;
export const contentType = "image/png";

const HEADERS = { "cache-control": "public, max-age=300, s-maxage=300" };

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = await params;
  const address = normaliseAddress(raw);
  const logo = await loadMark().catch(() => null);

  // A share card must always render something, so any failure falls back to a branded card.
  if (isValidAddress(address) && !setupProblem(address)) {
    try {
      const report = await loadWalletReport(address);
      if (report.summary.fillCount > 0) return new ImageResponse(<ReportCard report={report} logo={logo} />, { ...size, headers: HEADERS });
    } catch {
      // Falls through to the brand card below.
    }
  }

  const label = isValidAddress(address) ? shortenAddress(address) : "a wallet";
  return new ImageResponse(<BrandCard logo={logo} title="Wallet trading report" subtitle={`${label}. Win rate, gas costs, drawdown and the habits behind them.`} />, size);
}
