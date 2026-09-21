import type { Metadata } from "next";
import { AddressForm } from "@/components/home/address-form";
import { ReportView } from "@/components/report/report-view";
import { loadDemoReport } from "@/lib/report";

export const metadata: Metadata = { title: "Sample report" };

export default function DemoPage() {
  return <ReportView report={loadDemoReport()} right={<AddressForm variant="compact" />} />;
}
