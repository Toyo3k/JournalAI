"use client";

import Link from "next/link";
import styles from "@/components/report/report.module.css";

export default function WalletError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`container ${styles.page}`}>
      <section className={`${styles.card} ${styles.emptyState}`}>
        <h2>We couldn&apos;t load this wallet</h2>
        <p>{error.message || "Something went wrong while fetching trading history."}</p>
        <button type="button" className={styles.link} onClick={reset} style={{ background: "none", border: 0, padding: 0 }}>
          Try again
        </button>
        <Link href="/" className={styles.link}>
          Analyse a different wallet
        </Link>
      </section>
    </div>
  );
}
