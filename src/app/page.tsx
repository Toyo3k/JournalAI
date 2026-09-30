import Link from "next/link";
import { Socials } from "@/components/brand/socials";
import { TokenPanel } from "@/components/brand/token-panel";
import { AddressForm } from "@/components/home/address-form";
import { Preview } from "@/components/home/preview";
import styles from "@/components/home/landing.module.css";
import { NeuralField } from "@/components/report/charts/neural-field";
import { MAX_WALLETS } from "@/lib/address";

const icon = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const FEATURES = [
  {
    title: "Fumble check",
    body: "For every token you sold, see the highest price it reached afterwards and what it's worth today. Money left on the table, and the exits that saved you.",
    icon: icon("M3 17l6-6 4 4 8-8M15 7h6v6"),
    tag: "New",
    tone: "caution",
  },
  {
    title: "Every wallet, one report",
    body: `Paste up to ${MAX_WALLETS} wallets across Robinhood Chain and Solana. The chain is detected from each address, and you get one combined picture plus a per-wallet breakdown.`,
    icon: icon("M4 7h10M4 12h16M4 17h7M17 4l3 3-3 3"),
    tag: "New",
    tone: "accent",
  },
  {
    title: "A verdict and a score",
    body: "One honest sentence on how you trade, and a NeuroX score built from your edge, consistency and risk control.",
    icon: icon("M12 3a9 9 0 1 0 9 9M12 7v5l3 2"),
  },
  {
    title: "Habits, not just totals",
    body: "Whether you size up after losses, which tokens leak money, and which hours and days hurt your results.",
    icon: icon("M4 19V9m6 10V5m6 14v-7m4 7H2"),
  },
  {
    title: "Risk and holding time",
    body: "Drawdowns, streaks and how long you hold winners compared with losers, so you can see whether you cut too early.",
    icon: icon("M3 12h4l3-8 4 16 3-8h4"),
  },
  {
    title: "Share and compare",
    body: "Turn any report into a card for X or Telegram, or put two wallets side by side to see who really trades better.",
    icon: icon("M8 12h8M12 8v8M4 4h16v16H4z"),
  },
] as const;

const STEPS = [
  { title: "Paste wallets", body: "One address or several, from Robinhood Chain or Solana. No signup and no wallet connection." },
  { title: "We rebuild every trade", body: "Public token movements are read from Etherscan or Helius, turned into swaps and priced in USD, gas included." },
  { title: "Read the truth", body: "Your P&L, score, habits and fumbles, in plain language with the numbers behind every claim." },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <NeuralField className={styles.field} />
        <div className={`container ${styles.heroInner}`}>
          <p className={styles.eyebrow}>
            <span className={styles.wordmark} aria-hidden="true">
              NEURO<b>X</b>
            </span>
            <span className={styles.pill}>
              <i aria-hidden="true" /> Robinhood Chain and Solana. Read-only.
            </span>
          </p>
          <h1 className={styles.title}>
            Every trade you made, <span className={styles.titleAccent}>decoded.</span>
          </h1>
          <p className={styles.lede}>
            Paste one wallet or several. See what you really made after gas, the habits behind it, and what you left on the table by selling too
            early.
          </p>
          <div className={styles.formWrap}>
            <AddressForm variant="hero" />
          </div>
          <p className={styles.sample}>
            No address handy? <Link href="/demo">Open a sample report</Link>
          </p>
          <Socials className={styles.heroSocials} />
        </div>
      </section>

      <section className={`container ${styles.previewSection}`} aria-label="A live sample report">
        <Preview />
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="landing-features">
        <div className={styles.sectionHead}>
          <h2 id="landing-features" className="section-title">
            What you get
          </h2>
          <p className={styles.sectionLede}>A trading journal that writes itself from the chain.</p>
        </div>
        <div className={styles.features}>
          {FEATURES.map((feature) => (
            <article className={styles.feature} key={feature.title} data-tone={"tone" in feature ? feature.tone : undefined}>
              <div className={styles.featureHead}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                {"tag" in feature ? <span className={styles.tag}>{feature.tag}</span> : null}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="landing-steps">
        <div className={styles.sectionHead}>
          <h2 id="landing-steps" className="section-title">
            How it works
          </h2>
          <p className={styles.sectionLede}>From address to insight in seconds.</p>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li className={styles.step} key={step.title}>
              <span className={styles.stepNode} aria-hidden="true">
                {i + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`container ${styles.section} ${styles.bands}`}>
        <div className={styles.band}>
          <h2>Nothing to connect. Nothing to sign.</h2>
          <p>NeuroX only reads what is already public. We never ask for wallet access, signatures or keys, and we can&apos;t move your funds.</p>
        </div>
        <div className={styles.band}>
          <h2>Keep a private journal.</h2>
          <p>Log trades with your setup, mood and whether you followed the plan. It shows which habits pay, and it never leaves your browser.</p>
          <Link href="/journal" className={styles.bandLink}>
            Open your journal →
          </Link>
        </div>
      </section>

      <div className="container">
        <TokenPanel />
      </div>

      <section className={`container ${styles.section}`}>
        <div className={styles.cta}>
          <NeuralField className={styles.field} />
          <div className={styles.ctaInner}>
            <h2>See how you really trade.</h2>
            <p>Paste a wallet, or a few. It takes seconds and costs nothing.</p>
            <div className={styles.ctaForm}>
              <AddressForm variant="compact" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
