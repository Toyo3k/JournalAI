import { ImageResponse } from "next/og";
import { BrandCard, CARD_SIZE } from "@/components/share/report-card";

export const alt = "JournalAI. Trading insights from any Robinhood Chain wallet";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<BrandCard title="Understand your trading, from a wallet address." subtitle="Win rate, gas costs, drawdown and the habits behind them." />, size);
}
