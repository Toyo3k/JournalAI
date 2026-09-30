import { Socials } from "@/components/brand/socials";
import styles from "./layout.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p>
          <strong>Not financial advice.</strong> NeuroX describes past activity using public on-chain data. Insights highlight patterns in that history and do not predict future results.
        </p>
        <div className={styles.footerSide}>
          <p>Read-only. We never ask you to connect a wallet or sign anything.</p>
          <Socials />
        </div>
      </div>
    </footer>
  );
}
