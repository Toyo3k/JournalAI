import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddressForm } from "@/components/home/address-form";
import { ReportError } from "@/components/report/report-error";
import { ReportView } from "@/components/report/report-view";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import type { WalletReport } from "@/lib/analytics/types";
import { shortenAddress } from "@/lib/format";
import { loadWalletReport } from "@/lib/report";
import { SourceError } from "@/lib/robinhood/types";

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

  if (!process.env.ETHERSCAN_API_KEY) {
    return (
      <ReportError
        title="Robinhood Chain isn't set up yet"
        message="Add your Etherscan API key as ETHERSCAN_API_KEY in .env.local, then restart the dev server."
      />
    );
  }

  let report: WalletReport;
  try {
    report = await loadWalletReport(address);
  } catch (error) {
    // Only errors written for users are shown. Anything else is a bug and goes to the error boundary.
    if (error instanceof SourceError) {
      return <ReportError title="We couldn't load this history" message={error.message} />;
    }
    throw error;
  }

  return <ReportView report={report} right={<AddressForm variant="compact" initialValue={address} />} />;
}
