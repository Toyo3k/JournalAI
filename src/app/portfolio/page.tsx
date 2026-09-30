import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddressForm } from "@/components/home/address-form";
import { FumbleSection, FumbleSkeleton } from "@/components/report/fumbles";
import { ReportError } from "@/components/report/report-error";
import { ReportView } from "@/components/report/report-view";
import { WalletBreakdown } from "@/components/report/wallet-breakdown";
import { MAX_WALLETS, chainOf, normaliseAddress } from "@/lib/address";
import { loadPortfolioReport } from "@/lib/report";
import type { PortfolioResult } from "@/lib/report";
import { SourceError } from "@/lib/robinhood/types";

export const metadata: Metadata = {
  title: "Multi-wallet report",
  description: "One combined trading report across several Robinhood Chain and Solana wallets.",
};

interface PageProps {
  searchParams: Promise<{ w?: string | string[] }>;
}

export default async function PortfolioPage({ searchParams }: PageProps) {
  const { w } = await searchParams;
  const raw = (Array.isArray(w) ? w : w ? [w] : []).flatMap((value) => value.split(","));
  const addresses = [...new Set(raw.map(normaliseAddress).filter((address) => chainOf(address)))];
  const rejected = raw.length - addresses.length;

  if (!addresses.length) {
    return <ReportError title="Add some wallets" message="Paste two or more Robinhood Chain or Solana wallet addresses to see them combined in one report." />;
  }
  // One wallet has a report of its own, with its share card.
  if (addresses.length === 1) redirect(`/wallet/${addresses[0]}`);

  let result: PortfolioResult;
  try {
    result = await loadPortfolioReport(addresses);
  } catch (error) {
    // Only errors written for users are shown. Anything else is a bug and goes to the error boundary.
    if (error instanceof SourceError) return <ReportError title="We couldn't load these wallets" message={error.message} />;
    throw error;
  }

  const loaded = result.wallets.map((wallet) => wallet.address);
  const skipped = addresses.length > MAX_WALLETS ? addresses.length - MAX_WALLETS : 0;
  const notes = [
    ...(skipped ? [`Only the first ${MAX_WALLETS} wallets are combined. ${skipped} more ${skipped === 1 ? "was" : "were"} left out.`] : []),
    ...(rejected ? [`${rejected} ${rejected === 1 ? "entry wasn't" : "entries weren't"} a valid wallet address and ${rejected === 1 ? "was" : "were"} ignored.`] : []),
  ];

  return (
    <ReportView
      report={{ ...result.report, notes: [...notes, ...result.report.notes] }}
      right={<AddressForm variant="compact" initialValue={loaded.join(", ")} />}
      lead={{ title: "Wallets", content: <WalletBreakdown wallets={result.wallets} failed={result.failed} /> }}
      fumbles={
        <Suspense fallback={<FumbleSkeleton />}>
          <FumbleSection addresses={loaded} />
        </Suspense>
      }
    />
  );
}
