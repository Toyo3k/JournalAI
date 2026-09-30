import { chainOf } from "./address";
import type { Chain } from "./address";

/**
 * The official NeuroX token and social accounts, shown on the landing page and in the footer.
 * Fill these in to publish them. Anything left empty (or not a valid address or https link)
 * stays hidden, so a half-finished entry never shows a wrong address.
 */
export const OFFICIAL_TOKEN = {
  /** For example "NRX", without the $. */
  ticker: "",
  chain: "solana" as Chain,
  /** The token's contract address (Robinhood Chain) or mint address (Solana). */
  address: "",
};

export const SOCIALS: { kind: SocialKind; href: string }[] = [
  { kind: "x", href: "https://x.com/..." },
  // { kind: "telegram", href: "https://t.me/..." },
  // { kind: "discord", href: "https://discord.gg/..." },
];

export type SocialKind = "x" | "telegram" | "discord" | "github" | "website";

export const SOCIAL_LABELS: Record<SocialKind, string> = { x: "X", telegram: "Telegram", discord: "Discord", github: "GitHub", website: "Website" };

/** DexScreener's name for each chain. A token address URL opens that token's most liquid pair. */
const DEXSCREENER_CHAINS: Record<Chain, string> = { robinhood: "robinhood", solana: "solana" };

export interface TokenInfo {
  ticker: string;
  chain: Chain;
  address: string;
  /** The token's chart on DexScreener. */
  chartUrl: string;
}

/** The official token, or null until a valid address for the configured chain is filled in. */
export function officialToken(config = OFFICIAL_TOKEN): TokenInfo | null {
  const address = config.address.trim();
  if (!address || chainOf(address) !== config.chain) return null;
  return { ticker: config.ticker.trim().replace(/^\$/, ""), chain: config.chain, address, chartUrl: `https://dexscreener.com/${DEXSCREENER_CHAINS[config.chain]}/${address}` };
}

/** Social links with a real https URL, in the order given. */
export function socialLinks(links = SOCIALS): { kind: SocialKind; href: string; label: string }[] {
  return links
    .filter((link) => {
      try {
        return new URL(link.href).protocol === "https:";
      } catch {
        return false;
      }
    })
    .map((link) => ({ ...link, label: SOCIAL_LABELS[link.kind] }));
}
