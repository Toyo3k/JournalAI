import type { Bucket } from "@/lib/analytics/types";
import { formatPercent, formatUsd } from "@/lib/format";
import styles from "./report.module.css";

interface BarChartProps {
  buckets: Bucket[];
  /** Show a label under every nth bar. */
  labelEvery?: number;
  caption: string;
}

/** Diverging bars: profit rises above the midline, loss falls below it. */
export function BarChart({ buckets, labelEvery = 1, caption }: BarChartProps) {
  const peak = Math.max(1, ...buckets.map((bucket) => Math.abs(bucket.pnl)));

  return (
    <figure className={styles.bars}>
      <div className={styles.barTrack} style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}>
        {buckets.map((bucket) => {
          const size = `${(Math.abs(bucket.pnl) / peak) * 100}%`;
          const detail = bucket.trades
            ? `${bucket.label}: ${formatUsd(bucket.pnl, { signed: true })} over ${bucket.trades} trades, ${formatPercent(bucket.wins / bucket.trades, 0)} won`
            : `${bucket.label}: no trades`;
          return (
            <div className={styles.barCol} key={bucket.key} title={detail}>
              <div className={styles.barUp}>{bucket.pnl > 0 ? <i style={{ height: size }} className={styles.barGain} /> : null}</div>
              <div className={styles.barDown}>{bucket.pnl < 0 ? <i style={{ height: size }} className={styles.barLoss} /> : null}</div>
              <span className={styles.barLabel} data-hidden={Number(bucket.key) % labelEvery !== 0 ? "true" : undefined}>
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
