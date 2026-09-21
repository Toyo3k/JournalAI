import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import styles from "./layout.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="JournalAI home">
          <Logo />
          <div>
            Journal<span>AI</span>
          </div>
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link href="/journal" className={styles.navLink}>
            Journal
          </Link>
          <Link href="/demo" className={styles.navLink}>
            Sample report
          </Link>
        </nav>
      </div>
    </header>
  );
}
