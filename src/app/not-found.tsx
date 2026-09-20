import Link from "next/link";
import styles from "@/components/report/report.module.css";

export default function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <section className={`${styles.card} ${styles.emptyState}`}>
        <h2>Nothing here</h2>
        <p>That page or wallet address isn&apos;t valid. Addresses start with 0x followed by 40 hexadecimal characters.</p>
        <Link href="/" className={styles.link}>
          Back to home
        </Link>
      </section>
    </div>
  );
}
