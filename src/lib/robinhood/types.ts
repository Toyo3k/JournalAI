import type { Capabilities, Fill } from "../analytics/types";

/** What every source hands to the analytics layer. */
export interface SourceData {
  fills: Fill[];
  capabilities: Capabilities;
  /** True when older history exists that the source would not return. */
  truncated?: boolean;
  notes?: string[];
}

/**
 * An error whose message is safe to show to users. Anything else that is
 * thrown is treated as a bug and hidden behind the generic error page.
 */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
