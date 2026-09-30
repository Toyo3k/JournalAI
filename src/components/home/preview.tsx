import { EquityExplorer } from "@/components/report/charts/equity-explorer";
import { ScoreRing } from "@/components/report/charts/score-ring";
import { FumbleCard } from "@/components/report/fumbles";
import { formatPercent, formatRatio, formatUsd, pluralise } from "@/lib/format";
import { loadDemoFumbles } from "@/lib/fumbles";
import { loadDemoReport } from "@/lib/report";
import styles from "./landing.module.css";

/** A live slice of the sample report in a product window: hover the curve to step through trades. */
export function Preview() {
  const report = loadDemoReport();
  const { summary, visuals, score } = report;
  const fumble = loadDemoFumbles().report.fumbles[0];

  return (
    <div className={styles.window}>
      <div className={styles.windowBar} aria-hidden="true">
        <span />
        <span />
        <span />
        <p>neurox / sample report</p>
      </div>
      <div className={styles.windowBody}>
        <div className={styles.previewMain}>
          <div className={styles.previewHead}>
            <div>
              <span className={styles.kicker}>Net realized P&amp;L</span>
              <strong className={`pnl-gradient num ${styles.previewPnl}`} data-tone={summary.netPnl >= 0 ? "gain" : "loss"}>
                {formatUsd(summary.netPnl, { signed: true })}
              </strong>
            </div>
            <dl className={styles.previewStats}>
              <div>
                <dt>Win rate</dt>
                <dd className="num">{formatPercent(summary.winRate, 0)}</dd>
              </div>
              <div>
                <dt>Profit factor</dt>
                <dd className="num">{formatRatio(summary.profitFactor)}</dd>
              </div>
              <div>
                <dt>Trades</dt>
                <dd className="num">{summary.tradeCount}</dd>
              </div>
            </dl>
          </div>
          {report.verdict ? <p className={styles.previewVerdict}>{report.verdict}</p> : null}
          {visuals ? <EquityExplorer id="landing-equity" series={visuals.series} height={200} drawdownHeight={48} glow /> : null}
          <p className={styles.previewHint}>Hover or tap the curve to step through {pluralise(summary.tradeCount, "trade")}.</p>
        </div>

        <aside className={styles.previewSide}>
          {score ? (
            <div className={styles.previewScore}>
              <ScoreRing id="landing-score" score={score.value} size={132} stroke={10} glow />
              <ul>
                {score.parts.map((part) => (
                  <li key={part.key}>
                    <span>{part.label}</span>
                    <b className="num">{part.value}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {fumble ? (
            <div className={styles.previewFumble}>
              <span className={styles.kicker} data-tone="caution">
                Fumble check
              </span>
              <FumbleCard token={fumble} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
