import styles from "./report.module.css";

interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  tone?: "gain" | "loss";
  hint?: string;
}

export function StatCard({ label, value, note, tone, hint }: StatCardProps) {
  return (
    <div className={styles.stat} title={hint}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} num ${tone === "gain" ? "pos" : tone === "loss" ? "neg" : ""}`}>{value}</strong>
      {note ? <span className={styles.statNote}>{note}</span> : null}
    </div>
  );
}
