const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
/** Base58 (no 0, O, I or l), 32 to 44 characters. An EVM address can never match, since it contains a 0. */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type Chain = "robinhood" | "solana";

/** Which chain an address belongs to, told apart by its format. */
export function chainOf(value: string): Chain | null {
  const trimmed = value.trim();
  if (EVM_ADDRESS.test(trimmed)) return "robinhood";
  if (SOLANA_ADDRESS.test(trimmed)) return "solana";
  return null;
}

export function isValidAddress(value: string): boolean {
  return chainOf(value) !== null;
}

export const CHAIN_LABELS: Record<Chain, string> = { robinhood: "Robinhood Chain", solana: "Solana" };

/** The most wallets one combined report will load at once. */
export const MAX_WALLETS = 5;

export interface ParsedAddress {
  /** Normalised when valid, as typed otherwise. */
  value: string;
  chain: Chain | null;
}

/**
 * Splits pasted or typed text into addresses, on commas, semicolons, spaces or new lines.
 * Duplicates (after normalising) are dropped, so pasting the same wallet twice is harmless.
 */
export function parseAddressList(text: string): ParsedAddress[] {
  const seen = new Set<string>();
  const out: ParsedAddress[] = [];
  for (const token of text.split(/[\s,;]+/)) {
    if (!token) continue;
    const chain = chainOf(token);
    const value = chain ? normaliseAddress(token) : token;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ value, chain });
  }
  return out;
}

/** Where a set of valid addresses should go: one wallet gets its own report, several get a combined one. */
export function reportHref(addresses: string[]): string {
  if (addresses.length === 1) return `/wallet/${addresses[0]}`;
  return `/portfolio?${addresses.map((address) => `w=${encodeURIComponent(address)}`).join("&")}`;
}

/**
 * EVM addresses are case-insensitive, so lowercase gives stable URLs and cache
 * keys. Solana addresses are case-sensitive and are only trimmed.
 */
export function normaliseAddress(value: string): string {
  const trimmed = value.trim();
  return EVM_ADDRESS.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}
