import Link from "next/link";
import { CHAIN_LABELS } from "@/lib/address";
import { formatPercent, formatUsd } from "@/lib/format";
import type { PortfolioResult } from "@/lib/report";
import styles from "./report.module.css";

/** How each wallet contributed to the combined report, and any that could not be loaded. */
export function WalletBreakdown({ wallets, failed }: Pick<PortfolioResult, "wallets" | "failed">) {
  const peak = Math.max(1, ...wallets.map((wallet) => Math.abs(wallet.report.summary.netPnl)));

  return (
    <div className={styles.card}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Wallet</th>
              <th scope="col">Chain</th>
              <th scope="col" className={styles.right}>Trades</th>
              <th scope="col" className={styles.right}>Win rate</th>
              <th scope="col" className={styles.right}>Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(({ address, label, chain, report }) => {
              const { summary } = report;
              return (
                <tr key={address}>
                  <th scope="row">
                    <Link href={`/wallet/${address}`} className={`mono ${styles.link}`} title={`Open the report for ${address}`}>
                      {label}
                    </Link>
                  </th>
                  <td className={styles.dim}>{CHAIN_LABELS[chain]}</td>
                  <td className={`${styles.right} num`}>{summary.tradeCount}</td>
                  <td className={`${styles.right} num`}>{summary.tradeCount ? formatPercent(summary.winRate, 0) : "n/a"}</td>
                  <td className={styles.right}>
                    <span className={styles.pnlCell}>
                      <span className={styles.miniBar} aria-hidden="true">
                        <i className={summary.netPnl >= 0 ? styles.barGain : styles.barLoss} style={{ width: `${(Math.abs(summary.netPnl) / peak) * 100}%` }} />
                      </span>
                      <span className={`num ${summary.netPnl >= 0 ? "pos" : "neg"}`}>{formatUsd(summary.netPnl, { signed: true })}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {failed.length ? (
        <ul className={styles.failedList} aria-label="Wallets that could not be loaded">
          {failed.map((wallet) => (
            <li key={wallet.address}>
              <span className="mono">{wallet.label}</span> was left out: {wallet.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
