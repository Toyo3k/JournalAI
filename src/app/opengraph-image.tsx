import { ImageResponse } from "next/og";
import { BrandCard, CARD_SIZE, loadMark } from "@/components/share/report-card";

export const alt = "NeuroX. Trading insights from any Robinhood Chain or Solana wallet";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const logo = await loadMark().catch(() => null);
  return new ImageResponse(
    <BrandCard logo={logo} title="Understand your trading, from a wallet address." subtitle="Win rate, gas costs, drawdown and the habits behind them." />,
    size,
  );
}
