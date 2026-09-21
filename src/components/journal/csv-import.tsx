"use client";

import { useId, useState } from "react";
import { pluralise } from "@/lib/format";
import { CsvError, importCsv } from "@/lib/journal/csv";
import type { JournalEntry } from "@/lib/journal/types";
import styles from "./journal.module.css";

const MAX_BYTES = 2_000_000;

interface CsvImportProps {
  onImport: (entries: JournalEntry[]) => boolean;
  onCancel: () => void;
}

export function CsvImport({ onImport, onCancel }: CsvImportProps) {
  const inputId = useId();
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return setStatus({ tone: "error", text: "Choose a CSV file first." });
    if (file.size > MAX_BYTES) return setStatus({ tone: "error", text: "That file is over 2 MB. Split it into smaller files." });

    setBusy(true);
    try {
      const { entries, skipped } = importCsv(await file.text());
      if (!entries.length) throw new CsvError("No rows had both a ticker and a readable P&L.");
      if (!onImport(entries)) throw new CsvError("This browser would not let us save. Check that storage is not blocked or full.");
      setStatus({
        tone: "ok",
        text: `Imported ${pluralise(entries.length, "trade")} from ${file.name}.${skipped ? ` ${pluralise(skipped, "row")} skipped for a missing ticker or P&L.` : ""}`,
      });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof CsvError ? error.message : "That file could not be read as a CSV." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.importer}>
      <p className={styles.help}>
        Your file is read in this browser and never uploaded. It needs a <b>ticker</b> column (symbol, ticker, asset) and a{" "}
        <b>realized P&amp;L</b> column (pnl, profit, net pnl). These are optional: side, size, setup, emotion, rules, notes, date.
      </p>
      <label htmlFor={inputId} className="sr-only">
        CSV file
      </label>
      <input
        id={inputId}
        type="file"
        accept=".csv,text/csv"
        className={styles.file}
        onChange={(event) => {
          void handle(event.target.files?.[0]);
          event.target.value = "";
        }}
        disabled={busy}
      />
      {busy ? <p className={styles.help}>Reading your file…</p> : null}
      {status ? (
        <p className={status.tone === "ok" ? styles.success : styles.error} role={status.tone === "ok" ? "status" : "alert"}>
          {status.text}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button type="button" className={styles.ghost} onClick={onCancel}>
          Close
        </button>
      </div>
    </div>
  );
}
