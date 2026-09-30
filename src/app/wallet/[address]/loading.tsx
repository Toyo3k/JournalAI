import { NeuralField } from "@/components/report/charts/neural-field";
import neural from "@/components/report/neural.module.css";
import styles from "@/components/report/report.module.css";

/** Mirrors the report's hero, so the page doesn't jump when the real content streams in. */
export default function Loading() {
  return (
    <div className={neural.report} role="status" aria-live="polite">
      <header className={neural.hero}>
        <NeuralField className={neural.field} />
        <div className={`container ${neural.heroInner}`}>
          <div className={neural.heroCopy}>
            <p className={neural.loadingNote}>
              <span className={neural.loadingDot} aria-hidden="true" />
              Reading on-chain history and rebuilding every trade. This usually takes 5 to 15 seconds.
            </p>
            <div className={styles.skeleton} style={{ height: 14, width: 220 }} />
            <div className={styles.skeleton} style={{ height: 60, width: "min(360px, 80%)", borderRadius: 12 }} />
            <div className={styles.skeleton} style={{ height: 14, width: "min(300px, 70%)" }} />
            <div className={styles.skeleton} style={{ height: 48, width: "min(520px, 95%)", marginTop: 8 }} />
          </div>
          <div className={neural.scoreCol}>
            <div className={styles.skeleton} style={{ height: 200, width: 200, borderRadius: "50%" }} />
          </div>
        </div>
      </header>
      <div className={`container ${neural.body}`}>
        <div className={neural.twoUp}>
          <div className={styles.skeleton} style={{ height: 180, borderRadius: 20 }} />
          <div className={styles.skeleton} style={{ height: 180, borderRadius: 20 }} />
        </div>
        <div className={styles.skeleton} style={{ height: 420, borderRadius: 20 }} />
      </div>
    </div>
  );
}
