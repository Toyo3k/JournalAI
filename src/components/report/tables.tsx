import type { AssetStat, ClosedTrade } from "@/lib/analytics/types";
import { formatDateTime, formatPercent, formatUsd } from "@/lib/format";
import styles from "./report.module.css";

export function AssetTable({ assets }: { assets: AssetStat[] }) {
  const peak = Math.max(1, ...assets.map((asset) => Math.abs(asset.pnl)));

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Market</th>
            <th scope="col" className={styles.right}>Trades</th>
            <th scope="col" className={styles.right}>Win rate</th>
            <th scope="col" className={styles.right}>Volume</th>
            <th scope="col" className={styles.right}>Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {assets.slice(0, 8).map((asset) => (
            <tr key={asset.coin}>
              <th scope="row" className={styles.coin}>{asset.coin}</th>
              <td className={`${styles.right} num`}>{asset.trades}</td>
              <td className={`${styles.right} num`}>{asset.trades ? formatPercent(asset.winRate, 0) : "n/a"}</td>
              <td className={`${styles.right} num`}>{asset.volume > 0 ? formatUsd(asset.volume, { compact: true }) : "n/a"}</td>
              <td className={styles.right}>
                <span className={styles.pnlCell}>
                  <span className={styles.miniBar} aria-hidden="true">
                    <i
                      className={asset.pnl >= 0 ? styles.barGain : styles.barLoss}
                      style={{ width: `${(Math.abs(asset.pnl) / peak) * 100}%` }}
                    />
                  </span>
                  <span className={`num ${asset.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(asset.pnl, { signed: true, compact: true })}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TradesTable({ trades }: { trades: ClosedTrade[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Closed</th>
            <th scope="col">Market</th>
            <th scope="col">Side</th>
            <th scope="col" className={styles.right}>Size</th>
            <th scope="col" className={styles.right}>Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id}>
              <td className={`${styles.dim} num`}>{formatDateTime(trade.closedAt)}</td>
              <th scope="row" className={styles.coin}>{trade.coin}</th>
              <td>
                <span className={styles.side} data-side={trade.side}>{trade.side}</span>
              </td>
              <td className={`${styles.right} num`}>{formatUsd(trade.notional, { compact: true })}</td>
              <td className={`${styles.right} num ${trade.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(trade.pnl, { signed: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
