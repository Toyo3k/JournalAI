import Link from "next/link";
import { AddressForm } from "@/components/home/address-form";
import type { WalletReport } from "@/lib/analytics/types";
import { formatDate, formatPercent, formatRatio, formatUsd, pluralise, shortenAddress } from "@/lib/format";
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

export function ReportView({ report }: { report: WalletReport }) {
  const { summary, account } = report;
  const isDemo = report.source === "demo";
  const empty = summary.fillCount === 0;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.top}>
        <div>
          <Link href="/" className={styles.back}>
            ← New wallet
          </Link>
          <div className={styles.identity}>
            <h1 className={`mono ${styles.address}`} title={report.address}>
              {shortenAddress(report.address)}
            </h1>
            <span className={styles.badge} data-kind={isDemo ? "demo" : "live"}>
              {isDemo ? "Sample data" : "Hyperliquid"}
            </span>
          </div>
          {!empty ? (
            <p className={styles.range}>
              {pluralise(summary.tradeCount, "closed trade")} across {pluralise(summary.activeDays, "active day")}, {formatDate(summary.firstFillAt)} to{" "}
              {formatDate(summary.lastFillAt)}
            </p>
          ) : null}
        </div>
        <div className={styles.search}>
          <AddressForm variant="compact" initialValue={isDemo ? "" : report.address} />
        </div>
      </div>

      {isDemo ? (
        <p className={styles.notice} data-tone="info">
          This is a generated sample wallet that shows what a report looks like. Analyse a real address to see actual history.
        </p>
      ) : null}
      {report.truncated ? (
        <p className={styles.notice} data-tone="warn">
          This wallet has more history than the exchange exposes. The figures below cover its most recent fills only.
        </p>
      ) : null}

      {empty ? (
        <section className={`${styles.card} ${styles.emptyState}`}>
          <h2>No trading history found</h2>
          <p>
            This address has no fills on Hyperliquid. Check that you pasted the wallet used to trade, not a deposit or
            smart-contract address. Activity on other venues is not covered yet.
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
              note={`After ${formatUsd(summary.fees, { compact: true })} in fees`}
              tone={summary.netPnl >= 0 ? "gain" : "loss"}
              hint="Closed P&L minus all trading fees. Unrealized gains on open positions are not included."
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
            <Section title="Equity curve" subtitle="Cumulative realized P&L after fees">
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
                <Fact label="Maker fills" value={formatPercent(summary.makerShare, 0)} />
                {account ? (
                  <>
                    <Fact label="Account value" value={formatUsd(account.accountValue, { compact: true })} />
                    <Fact label="Open positions" value={account.openPositions} />
                  </>
                ) : null}
              </dl>
            </Section>
          </div>

          <Section
            title="Insights"
            subtitle="Patterns found in this wallet's own history. Each one cites the figures it is based on."
          >
            <InsightsPanel insights={report.insights} />
          </Section>

          <div className={styles.twoCol}>
            <Section title="When it trades" subtitle="Net P&L by hour of day and weekday, in UTC">
              <div className={styles.stack}>
                <BarChart buckets={report.hours} labelEvery={3} caption="Net profit and loss by hour of day in UTC" />
                <BarChart buckets={report.weekdays} caption="Net profit and loss by weekday" />
              </div>
            </Section>
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
          </div>

          <Section title="Markets" subtitle="Ranked by traded volume">
            <AssetTable assets={report.assets} />
          </Section>

          <Section title="Recent trades" subtitle="Latest closed trades, newest first">
            <TradesTable trades={report.recentTrades} />
          </Section>
        </>
      )}
    </div>
  );
}
