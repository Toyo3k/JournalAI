import { pluralise, shortenAddress } from "../format";
import { fetchSolUsd } from "../robinhood/prices";
import { reconstructTrades } from "../robinhood/swaps";
import type { GasCost, Kind, Transfer } from "../robinhood/swaps";
import { SourceError } from "../robinhood/types";
import type { SourceData } from "../robinhood/types";
import { fetchSymbols, fetchTransactions } from "./helius";
import type { HeliusTransaction } from "./helius";

const LAMPORTS_PER_SOL = 1e9;
export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

/**
 * Stablecoins are matched by mint, not symbol, so a counterfeit token named
 * USDC is treated as an ordinary token rather than being valued at $1.
 */
export const SOLANA_STABLES: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
};

function classify(transfer: Pick<Transfer, "assetId">): Kind {
  if (transfer.assetId === "native") return "native";
  return transfer.assetId in SOLANA_STABLES ? "usd" : "token";
}

/**
 * Turns Helius transactions into signed balance movements for one wallet.
 *
 * Balance changes are used instead of the listed transfers because Solana
 * swaps often wrap SOL into a temporary account and unwrap it again, which
 * shows up as several transfers but only one real change. Wrapped SOL counts
 * as SOL. The fee is added back to the SOL change and reported as gas, so it
 * is not mistaken for part of a swap.
 */
export function toTransfers(address: string, transactions: HeliusTransaction[]): { transfers: Transfer[]; gas: GasCost[] } {
  const transfers: Transfer[] = [];
  const gas: GasCost[] = [];

  for (const tx of transactions) {
    const time = tx.timestamp * 1000;
    const paidFee = tx.feePayer === address;
    if (paidFee && tx.fee > 0) gas.push({ hash: tx.signature, time, native: tx.fee / LAMPORTS_PER_SOL });
    // A failed transaction only charged the fee.
    if (tx.transactionError) continue;

    const net = new Map<string, number>();
    const add = (assetId: string, amount: number) => net.set(assetId, (net.get(assetId) ?? 0) + amount);

    for (const account of tx.accountData ?? []) {
      if (account.account === address) {
        add("native", (account.nativeBalanceChange + (paidFee ? tx.fee : 0)) / LAMPORTS_PER_SOL);
      }
      for (const change of account.tokenBalanceChanges ?? []) {
        if (change.userAccount !== address) continue;
        const amount = Number(change.rawTokenAmount.tokenAmount) / 10 ** change.rawTokenAmount.decimals;
        if (Number.isFinite(amount)) add(change.mint === WRAPPED_SOL ? "native" : change.mint, amount);
      }
    }

    for (const [assetId, amount] of net) {
      if (!amount) continue;
      const symbol = assetId === "native" ? "SOL" : (SOLANA_STABLES[assetId] ?? assetId);
      transfers.push({ hash: tx.signature, time, assetId, symbol, amount: Math.abs(amount), direction: amount > 0 ? "in" : "out" });
    }
  }

  return { transfers, gas };
}

export async function loadSolana(address: string): Promise<SourceData> {
  const { transactions, truncated } = await fetchTransactions(address);
  const { transfers, gas } = toTransfers(address, transactions);
  const capabilities = { shorts: false, fees: true };
  if (!transfers.length && !gas.length) return { fills: [], capabilities };

  const times = [...transfers.map((t) => t.time), ...gas.map((g) => g.time)];
  const solUsd = await fetchSolUsd(Math.min(...times), Date.now());
  const result = reconstructTrades({ transfers, gas, nativeUsd: solUsd, classify });

  if (!result.swaps && !result.fills.length && transactions.length) {
    throw new SourceError(
      result.skipped
        ? `This wallet's ${pluralise(result.skipped, "swap")} all went straight between two tokens. Those cannot be priced in USD yet, so there is nothing to report.`
        : "This wallet has activity on Solana, but no swaps that could be priced in USD.",
    );
  }

  // Symbols are only needed for the tokens that were actually traded.
  const mints = [...new Set(result.fills.flatMap((fill) => (fill.assetId && fill.coin === fill.assetId ? [fill.assetId] : [])))];
  const symbols = mints.length ? await fetchSymbols(mints) : new Map<string, string>();
  for (const fill of result.fills) {
    if (fill.assetId && fill.coin === fill.assetId) fill.coin = symbols.get(fill.assetId) ?? shortenAddress(fill.assetId);
  }

  const notes = [
    "Trades are rebuilt from balance changes. Stablecoins count as $1 and SOL is valued at its daily price, so figures are approximate. Rent for new token accounts is counted as part of the purchase.",
  ];
  if (result.skipped) notes.push(`${pluralise(result.skipped, "swap")} between two non-stable tokens could not be priced and ${result.skipped === 1 ? "was" : "were"} left out.`);
  if (result.untracked) notes.push(`${pluralise(result.untracked, "sale")} had no earlier purchase in the visible history, so ${result.untracked === 1 ? "it was" : "they were"} left out of P&L.`);

  return { fills: result.fills, capabilities, truncated, notes };
}
