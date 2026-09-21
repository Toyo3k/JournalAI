import type { Bucket, HoldingStats, RiskStats, StockContext } from "@/lib/analytics/types";
import { SESSION_HINTS, SESSION_ORDER } from "@/lib/analytics/sessions";
import { formatDuration, formatPercent, formatUsd, pluralise } from "@/lib/format";
import { StatCard } from "./stat-card";
import styles from "./report.module.css";

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

/** Rows of trades, win rate and P&L with a small diverging bar, for any grouping such as holding period or session. */
function BucketTable({ label, buckets, hints }: { label: string; buckets: Bucket[]; hints?: string[] }) {
  const peak = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket.pnl)));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col" className={styles.right}>Trades</th>
            <th scope="col" className={styles.right}>Win rate</th>
            <th scope="col" className={styles.right}>Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket, index) => (
            <tr key={bucket.key} data-empty={bucket.trades === 0 ? "true" : undefined}>
              <th scope="row" className={styles.coin} title={hints?.[index]}>
                {bucket.label}
              </th>
              <td className={`${styles.right} num`}>{bucket.trades}</td>
              <td className={`${styles.right} num`}>{bucket.trades ? formatPercent(bucket.wins / bucket.trades, 0) : "n/a"}</td>
              <td className={styles.right}>
                <span className={styles.pnlCell}>
                  <span className={styles.miniBar} aria-hidden="true">
                    <i className={bucket.pnl >= 0 ? styles.barGain : styles.barLoss} style={{ width: `${(Math.abs(bucket.pnl) / peak) * 100}%` }} />
                  </span>
                  <span className={`num ${bucket.trades === 0 ? "" : bucket.pnl >= 0 ? "pos" : "neg"}`}>
                    {bucket.trades ? formatUsd(bucket.pnl, { signed: true, compact: true }) : "n/a"}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HoldingSection({ holding }: { holding: HoldingStats }) {
  const { winnersAvgMs: win, losersAvgMs: lose } = holding;
  const ratio = win && lose ? lose / win : null;

  return (
    <Section title="Holding time" subtitle={`How long positions were held before closing, across ${pluralise(holding.trades, "trade")} with a known open time`}>
      <div className={styles.miniKpis}>
        <StatCard label="Average hold" value={formatDuration(holding.avgMs)} note="Across all trades" />
        <StatCard label="Median hold" value={formatDuration(holding.medianMs)} note="The typical trade" hint="Half of trades were held longer than this and half shorter, so one long hold does not skew it." />
        <StatCard label="Winners held" value={win === null ? "n/a" : formatDuration(win)} note="Average, profitable trades" />
        <StatCard
          label="Losers held"
          value={lose === null ? "n/a" : formatDuration(lose)}
          note={ratio === null ? "Average, losing trades" : `${ratio.toFixed(1)}x the time winners were held`}
          hint="Holding losers much longer than winners is known as the disposition effect."
          tone={ratio !== null && ratio >= 1.5 ? "loss" : undefined}
        />
      </div>
      <BucketTable label="Held for" buckets={holding.buckets} />
      <p className={styles.footnote}>Each sale is dated by the oldest shares it sold (first in, first out), so a position built up over several buys is timed from its earliest purchase.</p>
    </Section>
  );
}

const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export function RiskSection({ risk }: { risk: RiskStats }) {
  const kellyValue = risk.kelly === null ? "n/a" : risk.kelly <= 0 ? "No edge" : pct(risk.kelly);

  return (
    <Section title="Risk" subtitle="How bumpy the ride was, beyond the headline P&L">
      <div className={styles.miniKpis}>
        <StatCard
          label="Sharpe-like ratio"
          value={risk.sharpe === null ? "n/a" : risk.sharpe.toFixed(2)}
          note="Daily P&L, annualised"
          tone={risk.sharpe === null ? undefined : risk.sharpe > 0 ? "gain" : "loss"}
          hint="Average daily P&L divided by how much it swings, annualised. There is no capital base to measure returns against, so read it as a consistency score, not a textbook Sharpe."
        />
        <StatCard
          label="Sortino-like ratio"
          value={risk.sortino === null ? "n/a" : risk.sortino.toFixed(2)}
          note="Only losing days count as risk"
          tone={risk.sortino === null ? undefined : risk.sortino > 0 ? "gain" : "loss"}
          hint="Like the Sharpe-like ratio, but big winning days are not penalised as volatility."
        />
        <StatCard
          label="Kelly fraction"
          value={kellyValue}
          note={risk.kelly !== null && risk.kelly > 0 ? `Half-Kelly ${pct(risk.kelly / 2)} per trade` : "Suggested risk per trade"}
          tone={risk.kelly === null ? undefined : risk.kelly > 0 ? "gain" : "loss"}
          hint="The share of capital the win rate and payoff suggest risking per trade. It assumes your past edge continues, so most traders use half of it or less."
        />
        <StatCard
          label="Recovery factor"
          value={risk.recoveryFactor === null ? "n/a" : `${risk.recoveryFactor.toFixed(2)}x`}
          note="Net P&L ÷ max drawdown"
          tone={risk.recoveryFactor === null ? undefined : risk.recoveryFactor >= 1 ? "gain" : "loss"}
          hint="How many times the worst drawdown the wallet has earned back."
        />
        <StatCard
          label="Longest drawdown"
          value={risk.longestDrawdownMs ? formatDuration(risk.longestDrawdownMs) : "None"}
          note={risk.underwater ? `Still ${formatUsd(risk.currentDrawdown, { compact: true })} below peak` : "Fully recovered"}
          tone={risk.underwater ? "loss" : undefined}
          hint="The longest stretch spent below a previous high in realized P&L."
        />
        <StatCard
          label="Value at risk (95%)"
          value={risk.var95 === null ? "n/a" : formatUsd(risk.var95, { compact: true })}
          note="1 in 20 trades does worse"
          hint="The 5th percentile trade. One trade in twenty lost more than this, based on this wallet's own history."
        />
        <StatCard
          label="Worst vs average loss"
          value={risk.tailRatio === null ? "n/a" : `${risk.tailRatio.toFixed(1)}x`}
          note="Tail risk"
          tone={risk.tailRatio !== null && risk.tailRatio >= 4 ? "loss" : undefined}
          hint="How much worse the single worst loss was than a typical loss. High values mean a few trades do most of the damage."
        />
      </div>

      {risk.whatIfs.length ? (
        <div className={styles.whatIfs}>
          <h3>What if</h3>
          <p className={styles.footnote}>Hindsight, not advice. These show which habits cost the most, not what will happen next.</p>
          <ul>
            {risk.whatIfs.map((scenario) => (
              <li key={scenario.id}>
                <div>
                  <strong>{scenario.label}</strong>
                  <span>{scenario.detail}</span>
                </div>
                <em className="pos num">{formatUsd(scenario.delta, { signed: true, compact: true })}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

export function StockSection({ stocks }: { stocks: StockContext }) {
  const total = stocks.stockTrades + stocks.otherTrades;

  return (
    <Section title="Stock tokens" subtitle="Robinhood stock tokens, identified by their official contract addresses so lookalike tokens are not counted">
      <div className={styles.split}>
        <div className={styles.sideCard}>
          <span className={styles.subLabel}>Stock tokens</span>
          <strong className={`num ${stocks.stockPnl >= 0 ? "pos" : "neg"}`}>{formatUsd(stocks.stockPnl, { signed: true, compact: true })}</strong>
          <span className={styles.muted}>
            {pluralise(stocks.stockTrades, "trade")}, {formatPercent(stocks.stockTrades / total, 0)} of activity
          </span>
        </div>
        <div className={styles.sideCard}>
          <span className={styles.subLabel}>Everything else</span>
          <strong className={`num ${stocks.otherPnl >= 0 ? "pos" : "neg"}`}>{stocks.otherTrades ? formatUsd(stocks.otherPnl, { signed: true, compact: true }) : "n/a"}</strong>
          <span className={styles.muted}>{stocks.otherTrades ? pluralise(stocks.otherTrades, "trade") : "No other tokens traded"}</span>
        </div>
      </div>

      <h3 className={styles.subhead}>By US market session</h3>
      <p className={styles.footnote}>When each stock trade was closed. Stock tokens trade 24/5, but the underlying stock only trades in full during regular hours.</p>
      <BucketTable label="Session" buckets={stocks.sessions} hints={SESSION_ORDER.map((session) => SESSION_HINTS[session])} />

      <h3 className={styles.subhead}>Stocks traded</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Company</th>
              <th scope="col" className={styles.right}>Trades</th>
              <th scope="col" className={styles.right}>Win rate</th>
              <th scope="col" className={styles.right}>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {stocks.tokens.slice(0, 8).map((token) => (
              <tr key={token.symbol}>
                <th scope="row" className={styles.coin}>{token.symbol}</th>
                <td>{token.name}</td>
                <td className={`${styles.right} num`}>{token.trades}</td>
                <td className={`${styles.right} num`}>{formatPercent(token.winRate, 0)}</td>
                <td className={`${styles.right} num ${token.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(token.pnl, { signed: true, compact: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
