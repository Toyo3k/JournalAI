import Link from "next/link";
import type { WalletReport } from "@/lib/analytics/types";
import { formatDate, formatPercent, formatRatio, formatUsd, pluralise } from "@/lib/format";
import { EquityExplorer } from "./charts/equity-explorer";
import { CalendarHeatmap, HourWeekdayHeatmap, WIDE_CALENDAR_WEEKS } from "./charts/heatmaps";
import { TipLayer } from "./charts/tip-layer";
import { HoldingSection, RiskSection, StockSection } from "./context-sections";
import { CompactHero, ReportHero, sourceLabel } from "./report-hero";
import { Signals } from "./signals";
import { AssetTable, TradesTable } from "./tables";
import neural from "./neural.module.css";
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

/** A titled group of panels, headed in wide-tracked display caps. */
function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className={neural.group} aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface ReportViewProps {
  report: WalletReport;
  /** Shown top right, for example the search form. Passed in so this view stays usable from client components. */
  right?: React.ReactNode;
  /** Shown under the verdict, for example share buttons. */
  actions?: React.ReactNode;
  /** Use a compact summary instead of the full hero, for pages that supply their own header. */
  hideHeader?: boolean;
  /** Hide the recent trades table when the page shows a richer one. */
  hideRecent?: boolean;
  /** Extra sections shown after the insights. */
  extra?: React.ReactNode;
  /** A group shown before the insights, for example the per-wallet breakdown of a combined report. */
  lead?: { title: string; content: React.ReactNode };
  /** The fumble check, usually streamed in, shown right after the insights. */
  fumbles?: React.ReactNode;
}

export function ReportView({ report, right, actions, hideHeader = false, hideRecent = false, extra, lead, fumbles }: ReportViewProps) {
  const { summary, capabilities, subject, visuals } = report;
  const empty = summary.fillCount === 0;

  const metrics: [string, React.ReactNode][] = [
    ["Win rate", formatPercent(summary.winRate)],
    ["Profit factor", formatRatio(summary.profitFactor)],
    ["Per trade", <span key="e" className={summary.expectancy >= 0 ? "pos" : "neg"}>{formatUsd(summary.expectancy, { signed: true })}</span>],
    ["Max drawdown", <span key="d" className="neg">{formatUsd(-summary.maxDrawdown, { compact: true })}</span>],
    ["Volume", formatUsd(summary.volume, { compact: true })],
    ...(capabilities.fees ? ([["Fees paid", formatUsd(summary.fees, { compact: true })]] as [string, React.ReactNode][]) : []),
    ["Best trade", summary.best ? <span key="b" className="pos">{formatUsd(summary.best.pnl, { signed: true })} {summary.best.coin}</span> : "n/a"],
    ["Worst trade", summary.worst ? <span key="w" className="neg">{formatUsd(summary.worst.pnl, { signed: true })} {summary.worst.coin}</span> : "n/a"],
    ["Streaks", `${summary.longestWinStreak} wins, ${summary.longestLossStreak} losses`],
  ];

  return (
    <div className={neural.report}>
      {hideHeader ? null : <ReportHero report={report} right={right} actions={actions} />}

      <div className={`container ${neural.body}`}>
        {hideHeader ? <CompactHero report={report} /> : null}

        {report.source === "demo" || report.truncated || report.notes.length ? (
          <div className={neural.stack}>
            {report.source === "demo" ? (
              <p className={styles.notice} data-tone="info">
                This is a generated sample wallet that shows what a report looks like. Analyse a real address to see actual history.
              </p>
            ) : null}
            {report.truncated ? (
              <p className={styles.notice} data-tone="warn">
                {report.source === "portfolio"
                  ? "At least one of these wallets has more activity than we load at once, so the combined figures cover only part of its history. Open that wallet's own report for the details."
                  : report.source === "solana"
                    ? `This wallet has more activity than we load at once, so the figures below cover its most recent transactions only, from ${formatDate(summary.firstFillAt)}.`
                    : `This wallet has more activity than we load at once, so the figures below cover its earliest transactions only, up to ${formatDate(summary.lastFillAt)}.`}
              </p>
            ) : null}
            {report.notes.map((note) => (
              <p className={styles.notice} data-tone="info" key={note}>
                {note}
              </p>
            ))}
          </div>
        ) : null}

        {empty ? (
          <section className={`${styles.card} ${styles.emptyState}`}>
            <h2>No trading history found</h2>
            <p>
              {subject.kind === "portfolio"
                ? "None of these wallets has trades we could price. "
                : `Nothing was found for ${subject.label} on ${sourceLabel(report)}. `}
              Check that you pasted the wallet used to trade, rather than a deposit or contract address.
            </p>
            <Link href="/demo" className={styles.link}>
              See a sample report
            </Link>
          </section>
        ) : (
          <>
            {lead ? (
              <Group id="report-lead" title={lead.title}>
                {lead.content}
              </Group>
            ) : null}

            <Group id="report-signals" title="Signals">
              <Signals insights={report.insights} />
            </Group>

            {fumbles ? (
              <Group id="report-fumbles" title="Fumbles">
                {fumbles}
              </Group>
            ) : null}

            {extra}

            <Group id="report-trajectory" title="Trajectory">
              <div className={styles.card}>
                <dl className={neural.metrics}>
                  {metrics.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className="num">{value}</dd>
                    </div>
                  ))}
                </dl>
                {visuals && visuals.series.length >= 2 ? (
                  <>
                    <EquityExplorer id="report-equity" series={visuals.series} glow />
                    <p className={neural.chartHint}>
                      Hover, tap or use the arrow keys to see each trade.
                      {visuals.series.length < summary.tradeCount ? ` Showing ${visuals.series.length} of ${summary.tradeCount} trades, evenly spaced.` : ""}
                    </p>
                  </>
                ) : (
                  <p className={neural.chartEmpty}>One trade so far. The curve appears from the second.</p>
                )}
              </div>
            </Group>

            {visuals ? (
              <Group id="report-rhythm" title="Rhythm">
                <div className={neural.twoUp} data-wide={visuals.calendar.length / 7 > WIDE_CALENDAR_WEEKS ? "true" : undefined}>
                  <div className={styles.card}>
                    <div className={neural.panelHead}>
                      <span className={neural.panelLabel}>Every day</span>
                      <span className={neural.panelLabel}>{visuals.calendarClipped ? "Last 12 months" : "UTC days"}</span>
                    </div>
                    <TipLayer>
                      <CalendarHeatmap days={visuals.calendar} tips />
                    </TipLayer>
                  </div>
                  <div className={styles.card}>
                    <div className={neural.panelHead}>
                      <span className={neural.panelLabel}>Every hour</span>
                      <span className={neural.panelLabel}>UTC</span>
                    </div>
                    <TipLayer>
                      <HourWeekdayHeatmap grid={visuals.hourWeekday} cell={13} tips />
                    </TipLayer>
                  </div>
                </div>
                {capabilities.shorts ? (
                  <Section title="Long vs short">
                    <div className={styles.sides}>
                      {report.sides.map((side) => (
                        <div className={styles.sideCard} key={side.side}>
                          <span className={styles.side} data-side={side.side}>
                            {side.side}
                          </span>
                          <strong className={`num ${side.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(side.pnl, { signed: true, compact: true })}</strong>
                          <span className={styles.muted}>
                            {pluralise(side.trades, "trade")} · {side.trades ? formatPercent(side.winRate, 0) : "n/a"} won
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null}
              </Group>
            ) : null}

            <Group id="report-detail" title="Detail">
              {report.holding ? <HoldingSection holding={report.holding} /> : null}
              {report.risk ? <RiskSection risk={report.risk} /> : null}
              {report.stocks ? <StockSection stocks={report.stocks} /> : null}

              <Section title={capabilities.shorts ? "Markets" : "Tokens"} subtitle="Ranked by traded volume">
                <AssetTable assets={report.assets} />
              </Section>

              {hideRecent ? null : (
                <Section title="Recent trades" subtitle="Latest closed trades, newest first">
                  <TradesTable trades={report.recentTrades} />
                </Section>
              )}
            </Group>
          </>
        )}
      </div>
    </div>
  );
}
