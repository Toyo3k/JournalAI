import type { Fill } from "../analytics/types";

export interface Transfer {
  hash: string;
  time: number;
  /** Contract address, or "native" for the chain's ETH. */
  assetId: string;
  symbol: string;
  /** Decimal-adjusted, always positive. */
  amount: number;
  direction: "in" | "out";
}

export interface GasCost {
  hash: string;
  time: number;
  eth: number;
}

interface Input {
  transfers: Transfer[];
  gas: GasCost[];
  ethUsd: (ms: number) => number;
}

export interface Reconstruction {
  fills: Fill[];
  swaps: number;
  /** Swaps between two non-quote tokens, which cannot be priced. */
  skipped: number;
  /** Sales with no earlier purchase in the visible history, so no cost basis. */
  untracked: number;
}

type Kind = "usd" | "eth" | "token";

const STABLE = /^(USDC(\.E)?|USDT0?|USD₮0|DAI|USDS|USDG|PYUSD|FDUSD|USDE|LUSD|GUSD|TUSD)$/i;
const DUST = 1e-9;

function classify(transfer: Pick<Transfer, "assetId" | "symbol">): Kind {
  if (transfer.assetId === "native" || /^w?eth$/i.test(transfer.symbol)) return "eth";
  if (STABLE.test(transfer.symbol)) return "usd";
  return "token";
}

interface Leg {
  key: string;
  symbol: string;
  kind: Kind;
  net: number;
}

interface Swap {
  hash: string;
  time: number;
  symbol: string;
  assetId: string;
  side: "buy" | "sell";
  amount: number;
  usd: number;
}

/**
 * Rebuilds trades from raw token movements. A transaction counts as a swap
 * when the wallet moves one non-quote token against a stablecoin or ETH. The
 * quote leg gives the dollar value. Realized P&L uses average cost per token.
 */
export function reconstructTrades({ transfers, gas, ethUsd }: Input): Reconstruction {
  const byHash = new Map<string, Transfer[]>();
  for (const transfer of transfers) {
    const list = byHash.get(transfer.hash);
    if (list) list.push(transfer);
    else byHash.set(transfer.hash, [transfer]);
  }

  const swaps: Swap[] = [];
  let skipped = 0;

  for (const [hash, group] of byHash) {
    const time = group[0].time;
    const legs = new Map<string, Leg>();
    for (const transfer of group) {
      const kind = classify(transfer);
      // Every stablecoin is $1 and native ETH is the same asset as WETH, so each collapses to one leg.
      const key = kind === "token" ? transfer.assetId : kind;
      const leg = legs.get(key) ?? { key, symbol: transfer.symbol, kind, net: 0 };
      leg.net += transfer.direction === "in" ? transfer.amount : -transfer.amount;
      legs.set(key, leg);
    }

    const active = [...legs.values()].filter((leg) => Math.abs(leg.net) > DUST);
    const tokens = active.filter((leg) => leg.kind === "token");
    if (!tokens.length) continue;

    // Two tokens moving in opposite directions is a token-to-token swap. It has no dollar leg to price it by.
    if (tokens.length > 1) {
      if (tokens.some((leg) => leg.net > 0) && tokens.some((leg) => leg.net < 0)) skipped += 1;
      continue;
    }

    const quote = active
      .filter((leg) => leg.kind !== "token")
      .reduce((total, leg) => total + (leg.kind === "usd" ? leg.net : leg.net * ethUsd(time)), 0);
    if (Math.abs(quote) < DUST) continue;

    const token = tokens[0];
    if (token.net > 0 && quote < 0) {
      swaps.push({ hash, time, symbol: token.symbol, assetId: token.key, side: "buy", amount: token.net, usd: -quote });
    } else if (token.net < 0 && quote > 0) {
      swaps.push({ hash, time, symbol: token.symbol, assetId: token.key, side: "sell", amount: -token.net, usd: quote });
    }
  }

  swaps.sort((a, b) => a.time - b.time || a.hash.localeCompare(b.hash));

  const positions = new Map<string, { quantity: number; cost: number }>();
  const fills: Fill[] = [];
  const swapHashes = new Set<string>();
  let untracked = 0;

  for (const swap of swaps) {
    const position = positions.get(swap.assetId) ?? { quantity: 0, cost: 0 };
    const base = { id: `${swap.hash}:${swap.side}`, coin: swap.symbol, time: swap.time, orderId: swap.hash, fee: 0 };

    if (swap.side === "buy") {
      position.quantity += swap.amount;
      position.cost += swap.usd;
      positions.set(swap.assetId, position);
      fills.push({ ...base, price: swap.usd / swap.amount, size: swap.amount, isBuy: true, dir: "Open Long", closedPnl: 0 });
      swapHashes.add(swap.hash);
      continue;
    }

    const tracked = Math.min(swap.amount, position.quantity);
    if (tracked <= DUST) {
      untracked += 1;
      continue;
    }

    const average = position.cost / position.quantity;
    const proceeds = swap.usd * (tracked / swap.amount);
    position.cost -= average * tracked;
    position.quantity -= tracked;
    positions.set(swap.assetId, position);

    fills.push({
      ...base,
      price: swap.usd / swap.amount,
      size: tracked,
      isBuy: false,
      dir: "Close Long",
      closedPnl: proceeds - average * tracked,
    });
    swapHashes.add(swap.hash);
  }

  // Gas rides on the swap it paid for. Gas for approvals, transfers and failed
  // transactions has no swap to attach to, so it becomes a fee-only fill.
  const feeByHash = new Map<string, number>();
  for (const cost of gas) feeByHash.set(cost.hash, (feeByHash.get(cost.hash) ?? 0) + cost.eth * ethUsd(cost.time));

  const attached = new Set<string>();
  for (const fill of fills) {
    if (attached.has(fill.orderId)) continue;
    fill.fee = feeByHash.get(fill.orderId) ?? 0;
    attached.add(fill.orderId);
  }
  for (const cost of gas) {
    if (swapHashes.has(cost.hash)) continue;
    fills.push({
      id: `${cost.hash}:gas`,
      coin: "GAS",
      price: 0,
      size: 0,
      isBuy: false,
      time: cost.time,
      dir: "Gas",
      closedPnl: 0,
      fee: feeByHash.get(cost.hash) ?? 0,
      orderId: cost.hash,
    });
    feeByHash.delete(cost.hash);
  }

  return { fills, swaps: swaps.length, skipped, untracked };
}
