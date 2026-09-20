const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function isValidAddress(value: string): boolean {
  return EVM_ADDRESS.test(value);
}

/** Addresses are case-insensitive, so lowercase gives stable URLs and cache keys. */
export function normaliseAddress(value: string): string {
  return value.trim().toLowerCase();
}
