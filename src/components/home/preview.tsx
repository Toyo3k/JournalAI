import { EquityChart } from "@/components/report/equity-chart";
import { formatPercent, formatRatio, formatUsd } from "@/lib/format";
import { loadDemoReport } from "@/lib/report";
import styles from "./home.module.css";

/** A cropped slice of the sample report, so visitors see the product before using it. */
export function Preview() {
  const { summary, equity } = loadDemoReport();

  return (
    <div className={styles.previewFrame}>
      <span className={styles.previewTag}>Sample report</span>
      <div className={styles.previewBody}>
        <div className={styles.previewStats}>
          <div className={styles.previewStat}>
            <span>Net realized P&amp;L</span>
            <strong className={`num ${summary.netPnl >= 0 ? "pos" : "neg"}`}>{formatUsd(summary.netPnl, { signed: true })}</strong>
          </div>
          <div className={styles.previewStat}>
            <span>Win rate</span>
            <strong className="num">{formatPercent(summary.winRate)}</strong>
          </div>
          <div className={styles.previewStat}>
            <span>Profit factor</span>
            <strong className="num">{formatRatio(summary.profitFactor)}</strong>
          </div>
          <div className={styles.previewStat}>
            <span>Trades</span>
            <strong className="num">{summary.tradeCount}</strong>
          </div>
        </div>
        <EquityChart points={equity} height={230} />
      </div>
    </div>
  );
}
