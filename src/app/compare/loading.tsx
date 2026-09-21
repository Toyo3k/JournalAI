import styles from "@/components/compare/compare.module.css";
import report from "@/components/report/report.module.css";

export default function Loading() {
  return (
    <div className={`container ${styles.page}`} role="status" aria-live="polite">
      <span className="sr-only">Comparing wallets</span>
      <div className={report.skeleton} style={{ height: 40, width: 280 }} />
      <div className={report.skeleton} style={{ height: 150, borderRadius: 14 }} />
      <div className={styles.walletCards}>
        <div className={report.skeleton} style={{ height: 140, borderRadius: 14 }} />
        <div className={report.skeleton} style={{ height: 140, borderRadius: 14 }} />
      </div>
      <div className={report.skeleton} style={{ height: 380, borderRadius: 14 }} />
    </div>
  );
}
