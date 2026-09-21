import { ImageResponse } from "next/og";
import { ReportCard, CARD_SIZE } from "@/components/share/report-card";
import { loadDemoReport } from "@/lib/report";

export const alt = "A sample JournalAI wallet report";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<ReportCard report={loadDemoReport()} />, size);
}
