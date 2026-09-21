import Link from "next/link";
import { AddressForm } from "@/components/home/address-form";
import styles from "./report.module.css";

export function ReportError({ title, message }: { title: string; message: string }) {
  return (
    <div className={`container ${styles.page}`}>
      <section className={`${styles.card} ${styles.emptyState}`} role="alert">
        <h2>{title}</h2>
        <p>{message}</p>
        <Link href="/" className={styles.link}>
          Back to home
        </Link>
      </section>
      <div className={styles.search}>
        <AddressForm variant="compact" />
      </div>
    </div>
  );
}
