import { pluralise } from "../format";
import { SourceError } from "./types";
import type { SourceData } from "./types";
import { fetchAll } from "./etherscan";
import type { Row } from "./etherscan";
import { fetchEthUsd } from "./prices";
import { reconstructTrades } from "./swaps";
import type { GasCost, Transfer } from "./swaps";

const num = (value: string | undefined) => Number(value ?? 0);

function toTransfers(address: string, normal: Row[], internal: Row[], tokens: Row[]): { transfers: Transfer[]; gas: GasCost[] } {
  const transfers: Transfer[] = [];
  const gas: GasCost[] = [];
  const me = address.toLowerCase();

  const native = (row: Row) => {
    if (row.isError === "1" || row.value === "0" || !row.value) return;
    const from = row.from?.toLowerCase();
    const to = row.to?.toLowerCase();
    const direction = from === me ? "out" : to === me ? "in" : null;
    if (!direction) return;
    transfers.push({ hash: row.hash, time: num(row.timeStamp) * 1000, assetId: "native", symbol: "ETH", amount: num(row.value) / 1e18, direction });
  };

  for (const row of normal) {
    native(row);
    if (row.from?.toLowerCase() === me) {
      gas.push({ hash: row.hash, time: num(row.timeStamp) * 1000, eth: (num(row.gasUsed) * num(row.gasPrice)) / 1e18 });
    }
  }
  for (const row of internal) native(row);

  for (const row of tokens) {
    const from = row.from?.toLowerCase();
    const to = row.to?.toLowerCase();
    const direction = from === me ? "out" : to === me ? "in" : null;
    const amount = num(row.value) / 10 ** num(row.tokenDecimal);
    if (!direction || !Number.isFinite(amount) || amount <= 0) continue;
    transfers.push({
      hash: row.hash,
      time: num(row.timeStamp) * 1000,
      assetId: row.contractAddress.toLowerCase(),
      symbol: row.tokenSymbol || "TOKEN",
      amount,
      direction,
    });
  }

  return { transfers, gas };
}

export async function loadRobinhood(address: string): Promise<SourceData> {
  // Sequential on purpose: the free Etherscan tier allows only a few calls per second.
  const normal = await fetchAll("txlist", address);
  const internal = await fetchAll("txlistinternal", address);
  const tokens = await fetchAll("tokentx", address);

  const all = toTransfers(address, normal.rows, internal.rows, tokens.rows);

  // When a dataset hit its cap, it only reaches back to some moment. Rows from the other
  // datasets after that moment would be missing their counterparts (an ETH leg, or the gas
  // paid), so everything is cut to the earliest of those moments to keep swaps whole.
  const cutoffs = [normal, internal, tokens]
    .filter((set) => set.truncated && set.rows.length)
    .map((set) => num(set.rows[set.rows.length - 1].timeStamp) * 1000);
  const cutoff = cutoffs.length ? Math.min(...cutoffs) : Number.POSITIVE_INFINITY;
  const transfers = all.transfers.filter((transfer) => transfer.time < cutoff);
  const gas = all.gas.filter((cost) => cost.time < cutoff);
  const capabilities = { shorts: false, fees: true };
  if (!transfers.length && !gas.length) return { fills: [], capabilities };

  const times = [...transfers.map((t) => t.time), ...gas.map((g) => g.time)];
  const ethUsd = await fetchEthUsd(Math.min(...times), Date.now());
  const result = reconstructTrades({ transfers, gas, ethUsd });

  if (!result.swaps && !result.fills.length && (normal.rows.length || tokens.rows.length)) {
    throw new SourceError("This wallet has activity on Robinhood Chain, but no swaps that could be priced in USD.");
  }

  const notes = [
    "Trades are rebuilt from token transfers. Stablecoins count as $1 and ETH is valued at its daily price, so figures are approximate.",
  ];
  if (result.skipped) notes.push(`${pluralise(result.skipped, "swap")} between two non-stable tokens could not be priced and ${result.skipped === 1 ? "was" : "were"} left out.`);
  if (result.untracked) notes.push(`${pluralise(result.untracked, "sale")} had no earlier purchase in the visible history, so ${result.untracked === 1 ? "it was" : "they were"} left out of P&L.`);

  return {
    fills: result.fills,
    capabilities,
    truncated: normal.truncated || internal.truncated || tokens.truncated,
    notes,
  };
}
