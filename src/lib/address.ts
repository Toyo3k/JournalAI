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

/**
 * EVM addresses are case-insensitive, so lowercase gives stable URLs and cache
 * keys. Solana addresses are case-sensitive and are only trimmed.
 */
export function normaliseAddress(value: string): string {
  const trimmed = value.trim();
  return EVM_ADDRESS.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}
