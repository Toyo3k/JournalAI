import Link from "next/link";
import { InsightsPanel } from "@/components/report/insights-panel";
import type { Comparison, MetricFormat, MetricRow } from "@/lib/analytics/compare";
import type { WalletReport } from "@/lib/analytics/types";
import { formatDate, formatPercent, formatUsd, pluralise } from "@/lib/format";
import report from "@/components/report/report.module.css";
import { CompareChart } from "./compare-chart";
import styles from "./compare.module.css";

export interface Side {
  report: WalletReport;
  /** Short name used in the page and in the verdict sentences. */
  label: string;
  /** Link to this wallet's full report. */
  href: string;
}

function formatMetric(value: number | null, format: MetricFormat): string {
  if (value === null) return "n/a";
  if (value === Number.POSITIVE_INFINITY) return "No losses";
  switch (format) {
    case "usd":
      return formatUsd(value, { compact: true });
    case "usdSigned":
      return formatUsd(value, { signed: true, compact: true });
    case "percent":
      return formatPercent(value, 1);
    case "percentFine":
      return formatPercent(value, 2);
    case "ratio":
      return value.toFixed(2);
    case "count":
      return value.toLocaleString("en-US");
  }
}

function tone(row: MetricRow, value: number | null): string {
  if (row.format !== "usdSigned" || value === null) return "";
  return value >= 0 ? "pos" : "neg";
}

function WalletCard({ side, which }: { side: Side; which: "a" | "b" }) {
  const { summary } = side.report;
  return (
    <div className={styles.walletCard} data-side={which}>
      <div className={styles.walletHead}>
        <i aria-hidden="true" />
        <span className="mono">{side.label}</span>
        {side.report.source === "demo" ? <em>Sample</em> : null}
      </div>
      <strong className={`num ${summary.netPnl >= 0 ? "pos" : "neg"}`}>{formatUsd(summary.netPnl, { signed: true })}</strong>
      <span className={styles.walletMeta}>
        {pluralise(summary.tradeCount, "closed trade")}, {formatDate(summary.firstFillAt)} to {formatDate(summary.lastFillAt)}
      </span>
      <Link href={side.href} className={report.link}>
        Full report
      </Link>
    </div>
  );
}

export function CompareView({ a, b, comparison }: { a: Side; b: Side; comparison: Comparison }) {
  return (
    <>
      <div className={styles.walletCards}>
        <WalletCard side={a} which="a" />
        <WalletCard side={b} which="b" />
      </div>

      {comparison.smallSample ? (
        <p className={report.notice} data-tone="warn">
          At least one wallet has fewer than 20 closed trades, so treat these differences as a starting point rather than a verdict.
        </p>
      ) : null}

      {comparison.verdict.length ? (
        <section className={report.card}>
          <header className={report.cardHead}>
            <h2>Head to head</h2>
            <p>What separates these two wallets, in plain language.</p>
          </header>
          <ul className={styles.verdict}>
            {comparison.verdict.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={report.card}>
        <header className={report.cardHead}>
          <h2>Equity curves</h2>
          <p>Cumulative realized P&amp;L after fees, on a shared timeline</p>
        </header>
        <CompareChart
          series={[
            { label: a.label, color: "var(--series-a)", points: a.report.equity },
            { label: b.label, color: "var(--series-b)", points: b.report.equity },
          ]}
        />
      </section>

      <section className={report.card}>
        <header className={report.cardHead}>
          <h2>Metrics</h2>
          <p>The better value in each row is marked. Trades, days and volume describe activity, so they are not scored.</p>
        </header>
        <div className={report.tableWrap}>
          <table className={`${report.table} ${styles.metrics}`}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col" className={styles.colA}>{a.label}</th>
                <th scope="col" className={styles.colB}>{b.label}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" title={row.hint}>
                    {row.label}
                  </th>
                  {(["a", "b"] as const).map((which) => (
                    <td key={which} className={`num ${tone(row, row[which])}`} data-winner={row.winner === which ? "true" : undefined}>
                      {formatMetric(row[which], row.format)}
                      {row.winner === which ? (
                        <span className={styles.better}>
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">Better</span>
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {comparison.shared.length ? (
        <section className={report.card}>
          <header className={report.cardHead}>
            <h2>Shared markets</h2>
            <p>Tokens both wallets have traded, ranked by combined volume</p>
          </header>
          <div className={report.tableWrap}>
            <table className={`${report.table} ${styles.metrics}`}>
              <thead>
                <tr>
                  <th scope="col">Token</th>
                  <th scope="col" className={styles.colA}>{a.label} P&amp;L</th>
                  <th scope="col" className={styles.colA}>Win rate</th>
                  <th scope="col" className={styles.colB}>{b.label} P&amp;L</th>
                  <th scope="col" className={styles.colB}>Win rate</th>
                </tr>
              </thead>
              <tbody>
                {comparison.shared.slice(0, 8).map((market) => (
                  <tr key={market.coin}>
                    <th scope="row" className={report.coin}>{market.coin}</th>
                    <td className={`num ${market.a.pnl >= 0 ? "pos" : "neg"}`} data-winner={market.a.pnl > market.b.pnl ? "true" : undefined}>
                      {formatUsd(market.a.pnl, { signed: true, compact: true })}
                    </td>
                    <td className="num">{formatPercent(market.a.winRate, 0)}</td>
                    <td className={`num ${market.b.pnl >= 0 ? "pos" : "neg"}`} data-winner={market.b.pnl > market.a.pnl ? "true" : undefined}>
                      {formatUsd(market.b.pnl, { signed: true, compact: true })}
                    </td>
                    <td className="num">{formatPercent(market.b.winRate, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className={styles.insightCols}>
        {([a, b] as const).map((side, index) => (
          <section className={report.card} key={side.label}>
            <header className={report.cardHead}>
              <h2 className={styles.insightTitle} data-side={index === 0 ? "a" : "b"}>
                <i aria-hidden="true" /> {side.label}
              </h2>
              <p>Top insights for this wallet</p>
            </header>
            <InsightsPanel insights={side.report.insights.slice(0, 3)} />
          </section>
        ))}
      </div>
    </>
  );
}
