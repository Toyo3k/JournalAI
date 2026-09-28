import type { JournalEntry } from "./types";
import { DIRECTIONS } from "./types";

export const STORAGE_KEY = "neurox.journal.v1";
/** The key used before the NeuroX rename. Entries under it are copied forward once and never deleted. */
const LEGACY_STORAGE_KEY = "journalai.journal.v1";

/**
 * Copies entries saved under the pre-rename key into the new one, the first
 * time this runs in a browser that has old data. Idempotent: once the new key
 * exists at all (including an explicit empty save), it is left alone.
 */
export function migrateLegacyStorage(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== null) return;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) localStorage.setItem(STORAGE_KEY, legacy);
  } catch {
    // Storage may be blocked or full. Migration is best-effort and never throws.
  }
}

function isEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.asset === "string" &&
    typeof entry.pnl === "number" &&
    Number.isFinite(entry.pnl) &&
    typeof entry.date === "string" &&
    !Number.isNaN(Date.parse(entry.date)) &&
    DIRECTIONS.includes(entry.direction as (typeof DIRECTIONS)[number])
  );
}

/** Reads what is in storage defensively. Corrupt or hand-edited data is dropped rather than crashing the page. */
export function parseEntries(raw: string | null): JournalEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isEntry).map((entry) => ({
      ...entry,
      size: Number.isFinite(entry.size) ? entry.size : 0,
      setup: entry.setup ?? "",
      emotion: entry.emotion ?? "",
      rules: entry.rules ?? "",
      notes: entry.notes ?? "",
    }));
  } catch {
    return [];
  }
}

export const serialiseEntries = (entries: JournalEntry[]) => JSON.stringify(entries);

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
