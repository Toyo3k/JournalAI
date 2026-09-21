import Link from "next/link";
import type { WalletReport } from "@/lib/analytics/types";
import { formatDate, formatPercent, formatRatio, formatUsd, pluralise } from "@/lib/format";
import { BarChart } from "./bar-chart";
import { EquityChart } from "./equity-chart";
import { InsightsPanel } from "./insights-panel";
import { StatCard } from "./stat-card";
import { AssetTable, TradesTable } from "./tables";
import styles from "./report.module.css";

function Section({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${styles.card} ${className}`}>
      <header className={styles.cardHead}>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

interface ReportViewProps {
  report: WalletReport;
  /** Shown top right, for example the search form. Passed in so this view stays usable from client components. */
  right?: React.ReactNode;
  /** Hide the identity header when the page supplies its own. */
  hideHeader?: boolean;
  /** Hide the recent trades table when the page shows a richer one. */
  hideRecent?: boolean;
  /** Extra sections shown after the insights. */
  extra?: React.ReactNode;
}

const BADGES = { demo: "Sample data", journal: "Local journal", robinhood: "Robinhood Chain" } as const;

export function ReportView({ report, right, hideHeader = false, hideRecent = false, extra }: ReportViewProps) {
  const { summary, capabilities, subject } = report;
  const isDemo = report.source === "demo";
  const empty = summary.fillCount === 0;
  const sourceLabel = BADGES[report.source];

  return (
    <div className={`container ${styles.page} ${hideHeader ? styles.flush : ""}`}>
      {hideHeader ? null : <div className={styles.top}>
        <div>
          <Link href="/" className={`${styles.back} no-print`}>
            ← New wallet
          </Link>
          <div className={styles.identity}>
            <h1 className={`mono ${styles.address}`} title={subject.id}>
              {subject.label}
            </h1>
            <span className={styles.badge} data-kind={isDemo ? "demo" : "live"}>
              {sourceLabel}
            </span>
          </div>
          {!empty ? (
            <p className={styles.range}>
              {pluralise(summary.tradeCount, "closed trade")} across {pluralise(summary.activeDays, "active day")}, {formatDate(summary.firstFillAt)} to{" "}
              {formatDate(summary.lastFillAt)}
            </p>
          ) : null}
        </div>
        {right ? <div className={`${styles.search} no-print`}>{right}</div> : null}
      </div>}

      {isDemo ? (
        <p className={styles.notice} data-tone="info">
          This is a generated sample wallet that shows what a report looks like. Analyse a real address to see actual history.
        </p>
      ) : null}
      {report.truncated ? (
        <p className={styles.notice} data-tone="warn">
          This history is longer than the source will return, so the figures below cover only part of it.
        </p>
      ) : null}
      {report.notes.map((note) => (
        <p className={styles.notice} data-tone="info" key={note}>
          {note}
        </p>
      ))}

      {empty ? (
        <section className={`${styles.card} ${styles.emptyState}`}>
          <h2>No trading history found</h2>
          <p>
            Nothing was found for {subject.label} on {sourceLabel}. Check that you chose the right source and, for
            addresses, that you pasted the wallet used to trade rather than a deposit or contract address.
          </p>
          <Link href="/demo" className={styles.link}>
            See a sample report
          </Link>
        </section>
      ) : (
        <>
          <div className={styles.kpis}>
            <StatCard
              label="Net realized P&L"
              value={formatUsd(summary.netPnl, { signed: true })}
              note={capabilities.fees ? `After ${formatUsd(summary.fees, { compact: true })} in fees` : "Fees not itemised"}
              tone={summary.netPnl >= 0 ? "gain" : "loss"}
              hint="Closed P&L minus trading fees where the source reports them. Unrealized gains on open positions are not included."
            />
            <StatCard
              label="Win rate"
              value={formatPercent(summary.winRate)}
              note={`${summary.wins} won, ${summary.losses} lost`}
              hint="Share of closed trades that finished in profit after closing fees."
            />
            <StatCard
              label="Profit factor"
              value={formatRatio(summary.profitFactor)}
              note="Gross profit ÷ gross loss"
              tone={summary.profitFactor === null || summary.profitFactor >= 1 ? "gain" : "loss"}
              hint="Above 1 means winners outweigh losers in total dollars."
            />
            <StatCard
              label="Expectancy"
              value={formatUsd(summary.expectancy, { signed: true })}
              note="Average per closed trade"
              tone={summary.expectancy >= 0 ? "gain" : "loss"}
              hint="What a typical closed trade has returned after fees."
            />
          </div>

          <div className={styles.twoCol}>
            <Section title="Equity curve" subtitle={capabilities.fees ? "Cumulative realized P&L after fees" : "Cumulative realized P&L"}>
              <EquityChart points={report.equity} />
            </Section>
            <Section title="By the numbers">
              <dl className={styles.facts}>
                <Fact label="Trading volume" value={formatUsd(summary.volume, { compact: true })} />
                <Fact label="Max drawdown" value={<span className="neg">{formatUsd(-summary.maxDrawdown, { compact: true })}</span>} />
                <Fact label="Avg win / avg loss" value={`${formatUsd(summary.avgWin)} / ${formatUsd(summary.avgLoss)}`} />
                <Fact label="Best trade" value={summary.best ? <span className="pos">{formatUsd(summary.best.pnl, { signed: true })} {summary.best.coin}</span> : "n/a"} />
                <Fact label="Worst trade" value={summary.worst ? <span className="neg">{formatUsd(summary.worst.pnl, { signed: true })} {summary.worst.coin}</span> : "n/a"} />
                <Fact label="Longest streaks" value={`${summary.longestWinStreak} wins, ${summary.longestLossStreak} losses`} />
                {capabilities.fees ? <Fact label="Fees paid" value={formatUsd(summary.fees, { compact: true })} /> : null}
              </dl>
            </Section>
          </div>

          <Section
            title="Insights"
            subtitle="Patterns found in this trading history. Each one cites the figures it is based on."
          >
            <InsightsPanel insights={report.insights} />
          </Section>

          {extra}

          <div className={capabilities.shorts ? styles.twoCol : undefined}>
            <Section title="When it trades" subtitle="Net P&L by hour of day and weekday, in UTC">
              <div className={styles.stack}>
                <BarChart buckets={report.hours} labelEvery={3} caption="Net profit and loss by hour of day in UTC" />
                <BarChart buckets={report.weekdays} caption="Net profit and loss by weekday" />
              </div>
            </Section>
            {capabilities.shorts ? (
            <Section title="Long vs short">
              <div className={styles.sides}>
                {report.sides.map((side) => (
                  <div className={styles.sideCard} key={side.side}>
                    <span className={styles.side} data-side={side.side}>{side.side}</span>
                    <strong className={`num ${side.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(side.pnl, { signed: true, compact: true })}</strong>
                    <span className={styles.muted}>
                      {pluralise(side.trades, "trade")} · {side.trades ? formatPercent(side.winRate, 0) : "n/a"} won
                    </span>
                  </div>
                ))}
              </div>
            </Section>
            ) : null}
          </div>

          <Section title={capabilities.shorts ? "Markets" : "Tokens"} subtitle="Ranked by traded volume">
            <AssetTable assets={report.assets} />
          </Section>

          {hideRecent ? null : (
            <Section title="Recent trades" subtitle="Latest closed trades, newest first">
              <TradesTable trades={report.recentTrades} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
