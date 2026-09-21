import type { Metadata } from "next";
import { CompareForm } from "@/components/compare/compare-form";
import { CompareView } from "@/components/compare/compare-view";
import type { Side } from "@/components/compare/compare-view";
import report from "@/components/report/report.module.css";
import styles from "@/components/compare/compare.module.css";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import { compareReports } from "@/lib/analytics/compare";
import { shortenAddress } from "@/lib/format";
import { isDemoId, loadDemoReport, loadWalletReport } from "@/lib/report";
import { SourceError } from "@/lib/robinhood/types";

export const metadata: Metadata = {
  title: "Compare wallets",
  description: "Put two Robinhood Chain wallets side by side: returns, win rate, drawdown and habits.",
};

type Loaded = { side: Side } | { error: string };

const DEMO_LABELS = { demo: "Sample 1", "demo-2": "Sample 2" } as const;

async function load(raw: string): Promise<Loaded> {
  if (isDemoId(raw)) return { side: { report: loadDemoReport(raw), label: DEMO_LABELS[raw], href: "/demo" } };

  if (!isValidAddress(raw)) return { error: `${raw.slice(0, 24) || "That entry"} is not a valid wallet address.` };
  if (!process.env.ETHERSCAN_API_KEY) return { error: "Robinhood Chain isn't set up yet. Add ETHERSCAN_API_KEY to .env.local and restart." };

  try {
    const loaded = await loadWalletReport(raw);
    if (!loaded.summary.fillCount) return { error: `No trading history was found for ${shortenAddress(raw)}.` };
    return { side: { report: loaded, label: shortenAddress(raw), href: `/wallet/${raw}` } };
  } catch (error) {
    if (error instanceof SourceError) return { error: `${shortenAddress(raw)}: ${error.message}` };
    console.error(error);
    return { error: `Something went wrong loading ${shortenAddress(raw)}.` };
  }
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const query = await searchParams;
  const a = normaliseAddress(query.a ?? "");
  const b = normaliseAddress(query.b ?? "");
  const wanted = Boolean(a && b);
  const same = wanted && a === b;

  // Both wallets load together. The shared Etherscan queue keeps that inside the rate limit.
  const [first, second] = wanted && !same ? await Promise.all([load(a), load(b)]) : [null, null];
  const errors = [first, second].flatMap((result) => (result && "error" in result ? [result.error] : []));
  const ready = first && second && "side" in first && "side" in second ? { a: first.side, b: second.side } : null;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <h1>Compare wallets</h1>
        <p>Put two wallets side by side to see who earns more for the risk, how they differ, and where each is stronger.</p>
      </div>

      <section className={`${report.card} no-print`}>
        <CompareForm initialA={query.a ?? ""} initialB={query.b ?? ""} />
      </section>

      {(a || b) && !wanted ? (
        <p className={report.notice} data-tone="warn">
          Enter both wallets to compare them.
        </p>
      ) : null}
      {same ? (
        <p className={report.notice} data-tone="warn">
          You picked the same wallet twice. Choose two different wallets.
        </p>
      ) : null}
      {errors.map((message) => (
        <p key={message} className={report.notice} data-tone="warn" role="alert">
          {message}
        </p>
      ))}

      {ready ? <CompareView a={ready.a} b={ready.b} comparison={compareReports(ready.a.report, ready.b.report, ready.a.label, ready.b.label)} /> : null}
    </div>
  );
}
