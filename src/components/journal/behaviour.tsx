import type { GroupStat, JournalPatterns } from "@/lib/journal/patterns";
import { formatPercent, formatUsd } from "@/lib/format";
import report from "@/components/report/report.module.css";
import styles from "./journal.module.css";

function GroupTable({ label, rows }: { label: string; rows: GroupStat[] }) {
  if (!rows.length) return null;
  return (
    <div className={report.tableWrap}>
      <table className={report.table}>
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col" className={report.right}>Trades</th>
            <th scope="col" className={report.right}>Win rate</th>
            <th scope="col" className={report.right}>Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className={report.coin}>{row.name}</th>
              <td className={`${report.right} num`}>{row.trades}</td>
              <td className={`${report.right} num`}>{formatPercent(row.winRate, 0)}</td>
              <td className={`${report.right} num ${row.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(row.pnl, { signed: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Behaviour({ patterns }: { patterns: JournalPatterns }) {
  const { adherence } = patterns;
  const share = adherence ? adherence.followed / adherence.recorded : null;

  return (
    <section className={report.card}>
      <header className={report.cardHead}>
        <h2>Behaviour</h2>
        <p>How your state of mind, setups and discipline line up with results.</p>
      </header>

      <div className={styles.adherence}>
        <div>
          <span className={styles.adherenceLabel}>Plan adherence</span>
          <strong className="num">{share === null ? "n/a" : formatPercent(share, 0)}</strong>
        </div>
        <div className={styles.meter} aria-hidden="true">
          <i style={{ width: `${(share ?? 0) * 100}%` }} />
        </div>
        <span className={styles.adherenceNote}>
          {adherence ? `${adherence.followed} of ${adherence.recorded} trades followed the plan` : "Record rule adherence on your trades to track this"}
        </span>
      </div>

      <div className={styles.threeUp}>
        <GroupTable label="Emotion" rows={patterns.emotions} />
        <GroupTable label="Setup" rows={patterns.setups} />
        <GroupTable label="Plan" rows={patterns.rules} />
      </div>
    </section>
  );
}
