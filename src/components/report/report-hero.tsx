import Link from "next/link";
import type { NeuroScore, WalletReport } from "@/lib/analytics/types";
import { formatDate, formatUsd, pluralise } from "@/lib/format";
import { NeuralField } from "./charts/neural-field";
import { ScoreRing } from "./charts/score-ring";
import styles from "./neural.module.css";

const SOURCE_LABELS = { demo: "Sample data", journal: "Local journal", robinhood: "Robinhood Chain", solana: "Solana", portfolio: "Multi-wallet" } as const;

export const sourceLabel = (report: WalletReport) => SOURCE_LABELS[report.source];

function PnlBlock({ report }: { report: WalletReport }) {
  const { summary } = report;
  return (
    <>
      <strong className={`pnl-gradient num ${styles.pnl}`} data-tone={summary.netPnl >= 0 ? "gain" : "loss"}>
        {formatUsd(summary.netPnl, { signed: true })}
      </strong>
      <p className={styles.pnlLabel}>
        Net realized P&amp;L · {pluralise(summary.tradeCount, "trade")} · {formatDate(summary.firstFillAt)} to {formatDate(summary.lastFillAt)}
      </p>
      {report.verdict ? <p className={styles.verdict}>{report.verdict}</p> : null}
    </>
  );
}

function ScoreBlock({ score, size = 200 }: { score: NeuroScore; size?: number }) {
  return (
    <div className={styles.scoreCol}>
      <div className={styles.ringWrap}>
        <ScoreRing id="report-score" score={score.value} size={size} stroke={size > 150 ? 14 : 10} glow />
        {score.lowConfidence ? (
          <span className={styles.lowConfidence} title="Fewer than 20 closed trades, so this score can move a lot with a few more.">
            Low confidence
          </span>
        ) : null}
      </div>
      <ul className={styles.subs} aria-label="Score breakdown">
        {score.parts.map((part) => (
          <li key={part.key}>
            <span className={styles.node} aria-hidden="true" />
            <span className={styles.subLabel}>{part.label}</span>
            <b className="num">{part.value}</b>
            <small>{part.blurb}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HeroProps {
  report: WalletReport;
  /** Top right, for example the search form. */
  right?: React.ReactNode;
  /** Under the verdict, for example the share buttons. */
  actions?: React.ReactNode;
}

/** Full-bleed hero: the result first, the score beside it, over the logo's node field. */
export function ReportHero({ report, right, actions }: HeroProps) {
  const empty = report.summary.fillCount === 0;
  const isDemo = report.source === "demo";

  return (
    <header className={styles.hero}>
      <NeuralField className={styles.field} />
      <div className="container">
        <div className={`${styles.heroTop} no-print`}>
          <Link href="/" className={styles.back}>
            ← New wallet
          </Link>
          {right ? <div className={styles.search}>{right}</div> : null}
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span className={styles.wordmark} aria-hidden="true">
                NEURO<b>X</b> REPORT
              </span>
              <h1 className={styles.address} title={report.subject.id}>
                {report.subject.label}
              </h1>
              <span className={styles.badge} data-kind={isDemo ? "demo" : "live"}>
                {sourceLabel(report)}
              </span>
            </div>
            {empty ? null : <PnlBlock report={report} />}
            {actions ? <div className={styles.actions}>{actions}</div> : null}
          </div>

          {report.score ? <ScoreBlock score={report.score} /> : null}
        </div>
      </div>
    </header>
  );
}

/** The same result-first summary in a panel, for pages that already have their own header. */
export function CompactHero({ report }: { report: WalletReport }) {
  if (report.summary.fillCount === 0) return null;
  return (
    <section className={styles.compact} aria-label="Summary">
      <div className={styles.heroCopy}>
        <PnlBlock report={report} />
      </div>
      {report.score ? <ScoreBlock score={report.score} size={140} /> : null}
    </section>
  );
}
