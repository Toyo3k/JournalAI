import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import { shortenAddress } from "@/lib/format";
import { loadWalletReport } from "@/lib/report";

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  return { title: isValidAddress(address) ? `Wallet ${shortenAddress(address)}` : "Wallet" };
}

export default async function WalletPage({ params }: PageProps) {
  const { address: raw } = await params;
  const address = normaliseAddress(raw);
  if (!isValidAddress(address)) notFound();

  const report = await loadWalletReport(address);
  return <ReportView report={report} />;
}
