import Link from "next/link";
import { AddressForm } from "@/components/home/address-form";
import { Preview } from "@/components/home/preview";
import styles from "@/components/home/home.module.css";

const FEATURES = [
  {
    title: "The facts, straight",
    body: "Net P&L after gas, win rate, profit factor, drawdown, volume and streaks, all computed from the wallet's actual swaps.",
    icon: (
      <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    ),
  },
  {
    title: "Habits, not just totals",
    body: "See whether you size up after losses, which markets leak money, and which hours of the day hurt your results.",
    icon: (
      <path d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    ),
  },
  {
    title: "Insights you can verify",
    body: "Every observation states the numbers behind it. No generic coaching, and nothing invented beyond what the history shows.",
    icon: (
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    ),
  },
];

const STEPS = [
  { title: "Paste an address", body: "Any wallet that has traded on Robinhood Chain. No signup, no wallet connection." },
  { title: "We read the public history", body: "Token transfers are pulled read-only from Etherscan and rebuilt into swaps, priced in USD." },
  { title: "Get your review", body: "Grouped into closed trades and turned into metrics, charts and plain-language insights." },
];

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <span className={styles.pill}>
            <i /> Robinhood Chain. Read-only, from public data
          </span>
          <h1 className={styles.title}>
            Understand your trading, <em>from a wallet address.</em>
          </h1>
          <p className={styles.lede}>
            Paste a Robinhood Chain wallet and get a clear review of its trading history: what it made, what it paid, and
            the habits behind the results.
          </p>
          <div className={styles.formWrap}>
            <AddressForm />
            <p className={styles.hint}>
              No address handy? <Link href="/demo">Explore a sample report</Link>
            </p>
          </div>
        </div>
      </section>

      <section className={`container ${styles.previewSection}`} aria-label="Report preview">
        <Preview />
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>What you get</p>
          <h2 className={styles.sectionTitle}>A trade journal that writes itself.</h2>
        </div>
        <div className={styles.grid3}>
          {FEATURES.map((feature) => (
            <article className={styles.feature} key={feature.title}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  {feature.icon}
                </svg>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>How it works</p>
          <h2 className={styles.sectionTitle}>From address to insight in seconds.</h2>
        </div>
        <div className={`${styles.grid3} ${styles.steps}`}>
          {STEPS.map((step) => (
            <div className={styles.step} key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.privacy}>
          <div>
            <h2>Keep a private trade journal.</h2>
            <p>
              Log trades with your setup, emotion and whether you followed your plan, or import a CSV. JournalAI shows
              which habits help and which cost you, and it never leaves your browser.
            </p>
          </div>
          <Link href="/journal" className={styles.cta}>
            Open your journal
          </Link>
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.privacy}>
          <div>
            <h2>Nothing to connect. Nothing to sign.</h2>
            <p>
              JournalAI only reads what is already public. We never request wallet access, signatures or API keys, and
              we can&apos;t move your funds.
            </p>
          </div>
          <Link href="/demo" className={styles.cta}>
            View sample report
          </Link>
        </div>
      </section>
    </>
  );
}
