import type { StockRegistry } from "../analytics/stocks";
import { ROBINHOOD_CHAIN_ID } from "./etherscan";

const ENDPOINT = "https://api.robinhood.com/rhj/assets";

interface RawAsset {
  tokenSymbol?: string;
  tokenName?: string;
  status?: string;
  deployments?: { contractAddress?: string; chainId?: number }[];
}

/** "Tesla • Robinhood Token" becomes "Tesla". */
const companyName = (tokenName: string) => tokenName.replace(/\s*[•·]\s*Robinhood Token$/i, "").trim();

/** Builds the lookup tables from the official asset list. Exported separately so it can be tested without the network. */
export function parseRegistry(assets: RawAsset[]): StockRegistry {
  const byAddress = new Map<string, { symbol: string; name: string }>();
  const bySymbol = new Map<string, { symbol: string; name: string }>();

  for (const asset of assets) {
    if (asset.status !== "ASSET_STATUS_ACTIVE" || !asset.tokenSymbol) continue;
    const info = { symbol: asset.tokenSymbol, name: companyName(asset.tokenName ?? asset.tokenSymbol) };
    bySymbol.set(asset.tokenSymbol, info);
    for (const deployment of asset.deployments ?? []) {
      if (deployment.chainId === ROBINHOOD_CHAIN_ID && deployment.contractAddress) {
        byAddress.set(deployment.contractAddress.toLowerCase(), info);
      }
    }
  }
  return { byAddress, bySymbol };
}

/**
 * Robinhood's official public list of stock tokens, with each token's contract
 * address. Identifying by address is what stops a counterfeit token named TSLA
 * from being treated as the real thing. Returns null on any failure, because
 * stock context is a bonus and must never stop a report from loading.
 */
export async function loadStockRegistry(): Promise<StockRegistry | null> {
  try {
    const response = await fetch(ENDPOINT, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const body = (await response.json()) as { assets?: RawAsset[] };
    if (!Array.isArray(body.assets) || !body.assets.length) return null;
    const registry = parseRegistry(body.assets);
    return registry.byAddress.size ? registry : null;
  } catch {
    return null;
  }
}
