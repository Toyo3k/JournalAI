"use client";

import { useState } from "react";
import { formatDateTime, formatUsd } from "@/lib/format";
import type { JournalEntry } from "@/lib/journal/types";
import report from "@/components/report/report.module.css";
import styles from "./journal.module.css";

const INITIAL_ROWS = 25;

export function EntriesTable({ entries, onRemove }: { entries: JournalEntry[]; onRemove: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const ordered = [...entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const visible = showAll ? ordered : ordered.slice(0, INITIAL_ROWS);

  return (
    <>
      <div className={report.tableWrap}>
        <table className={report.table}>
          <thead>
            <tr>
              <th scope="col">Closed</th>
              <th scope="col">Trade</th>
              <th scope="col">Setup</th>
              <th scope="col">Emotion</th>
              <th scope="col">Plan</th>
              <th scope="col" className={report.right}>P&amp;L</th>
              <th scope="col" className="no-print">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.id}>
                <td className={`${report.dim} num`}>{formatDateTime(Date.parse(entry.date))}</td>
                <th scope="row" className={report.coin}>
                  {entry.asset} <span className={report.side} data-side={entry.direction}>{entry.direction}</span>
                  {entry.notes ? <span className={styles.entryNote} title={entry.notes}>{entry.notes}</span> : null}
                </th>
                <td>{entry.setup || "n/a"}</td>
                <td>{entry.emotion || "n/a"}</td>
                <td>{entry.rules || "n/a"}</td>
                <td className={`${report.right} num ${entry.pnl >= 0 ? "pos" : "neg"}`}>{formatUsd(entry.pnl, { signed: true })}</td>
                <td className="no-print">
                  <button type="button" className={styles.remove} onClick={() => onRemove(entry.id)} aria-label={`Delete ${entry.asset} trade`}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordered.length > INITIAL_ROWS ? (
        <button type="button" className={`${styles.ghost} no-print`} onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${ordered.length}`}
        </button>
      ) : null}
    </>
  );
}
