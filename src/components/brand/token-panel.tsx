import { CHAIN_LABELS } from "@/lib/address";
import { officialToken } from "@/lib/site";
import { CopyAddress } from "./copy-address";
import styles from "./brand.module.css";

/** The official token's contract address, with a copy button and a DexScreener link. Hidden until configured in lib/site.ts. */
export function TokenPanel() {
  const token = officialToken();
  if (!token) return null;
  const name = token.ticker ? `$${token.ticker}` : "NeuroX token";

  return (
    <section className={styles.token} aria-labelledby="official-token">
      <div className={styles.tokenHead}>
        <span className={styles.kicker}>Official token</span>
        <h2 id="official-token">
          {name} <span className={styles.chain}>{CHAIN_LABELS[token.chain]}</span>
        </h2>
        <p>This is the only official contract address. Copycat tokens use similar names, so always check the full address.</p>
      </div>
      <div className={styles.caRow}>
        <span className={styles.caLabel}>CA</span>
        {/* The full address, never shortened, so it can be checked character by character. */}
        <code className={styles.ca}>{token.address}</code>
        <CopyAddress address={token.address} />
        <a className={styles.chart} href={token.chartUrl} target="_blank" rel="noopener noreferrer">
          View chart on DexScreener ↗
        </a>
      </div>
    </section>
  );
}
