import Image from "next/image";
import Link from "next/link";
import styles from "./layout.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.brand} aria-label="NeuroX home">
          <Image src="/logo-mark.png" alt="" width={170} height={112} className={styles.brandMark} priority />
          <div>
            Neuro<span>X</span>
          </div>
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link href="/compare" className={styles.navLink}>
            Compare
          </Link>
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
