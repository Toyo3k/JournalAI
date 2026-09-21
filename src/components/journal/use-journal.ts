"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { STORAGE_KEY, parseEntries, serialiseEntries } from "@/lib/journal/storage";
import type { JournalEntry } from "@/lib/journal/types";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Other tabs write to the same storage, so follow them too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Journal entries persisted in this browser, kept in sync across components and tabs. */
export function useJournal() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const entries = useMemo(() => parseEntries(raw), [raw]);

  const write = useCallback((next: JournalEntry[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, serialiseEntries(next));
    } catch {
      return false;
    }
    listeners.forEach((listener) => listener());
    return true;
  }, []);

  return {
    entries,
    add: useCallback((items: JournalEntry[]) => write([...parseEntries(readRaw()), ...items]), [write]),
    remove: useCallback((id: string) => write(parseEntries(readRaw()).filter((entry) => entry.id !== id)), [write]),
    clear: useCallback(() => write([]), [write]),
  };
}
