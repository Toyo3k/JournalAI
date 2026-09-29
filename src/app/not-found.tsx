import Link from "next/link";
import styles from "@/components/report/report.module.css";

export default function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <section className={`${styles.card} ${styles.emptyState}`}>
        <h2>Nothing here</h2>
        <p>That page or wallet address isn&apos;t valid. Robinhood Chain addresses start with 0x followed by 40 hexadecimal characters, and Solana addresses are 32 to 44 base58 characters.</p>
        <Link href="/" className={styles.link}>
          Back to home
        </Link>
      </section>
    </div>
  );
}
