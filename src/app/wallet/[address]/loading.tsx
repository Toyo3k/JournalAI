import styles from "@/components/report/report.module.css";

export default function Loading() {
  return (
    <div className={`container ${styles.page}`} role="status" aria-live="polite">
      <span className="sr-only">Analysing wallet history</span>
      <div className={styles.skeleton} style={{ height: 34, width: 260, marginBottom: 18 }} />
      <div className={styles.kpis}>
        {[0, 1, 2, 3].map((i) => (
          <div className={styles.skeleton} style={{ height: 112, borderRadius: 14 }} key={i} />
        ))}
      </div>
      <div className={styles.twoCol}>
        <div className={styles.skeleton} style={{ height: 380, borderRadius: 14 }} />
        <div className={styles.skeleton} style={{ height: 380, borderRadius: 14 }} />
      </div>
      <div className={styles.skeleton} style={{ height: 260, borderRadius: 14 }} />
    </div>
  );
}
