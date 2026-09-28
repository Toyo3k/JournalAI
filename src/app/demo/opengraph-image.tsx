import { ImageResponse } from "next/og";
import { CARD_SIZE, ReportCard, loadMark } from "@/components/share/report-card";
import { loadDemoReport } from "@/lib/report";

export const alt = "A sample NeuroX wallet report";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const logo = await loadMark().catch(() => null);
  return new ImageResponse(<ReportCard report={loadDemoReport()} logo={logo} />, size);
}
