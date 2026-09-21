"use client";

import { useMemo, useState } from "react";
import { ReportView } from "@/components/report/report-view";
import { formatDate, pluralise } from "@/lib/format";
import { buildJournalReport } from "@/lib/journal/to-report";
import { Behaviour } from "./behaviour";
import { CsvImport } from "./csv-import";
import { EntriesTable } from "./entries-table";
import { TradeForm } from "./trade-form";
import { useJournal } from "./use-journal";
import report from "@/components/report/report.module.css";
import styles from "./journal.module.css";

const DAY_MS = 86_400_000;
const RANGES = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: null },
] as const;

type RangeId = (typeof RANGES)[number]["id"];
type Panel = "trade" | "csv" | null;

export function JournalApp() {
  const { entries, add, remove, clear } = useJournal();
  const [panel, setPanel] = useState<Panel>(null);
  const [range, setRange] = useState<RangeId>("all");
  // Captured when the range changes rather than during render, so the window stays stable between renders.
  const [now, setNow] = useState(() => Date.now());

  const days = RANGES.find((option) => option.id === range)?.days ?? null;
  const visible = useMemo(
    () => (days === null ? entries : entries.filter((entry) => Date.parse(entry.date) >= now - days * DAY_MS)),
    [entries, days, now],
  );
  const { report: journalReport, patterns } = useMemo(() => buildJournalReport(visible), [visible]);

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));
  const summary = journalReport.summary;

  return (
    <div className={styles.page}>
      <div className={`container ${styles.head}`}>
        <div>
          <p className={styles.eyebrow}>Local journal</p>
          <h1>Trade with evidence, not memory.</h1>
          <p className={styles.sub}>
            {entries.length
              ? `${pluralise(visible.length, "trade")} ${days === null ? "in your journal" : `in the ${RANGES.find((option) => option.id === range)?.label.toLowerCase()}`}${
                  summary.tradeCount ? `, ${formatDate(summary.firstFillAt)} to ${formatDate(summary.lastFillAt)}` : ""
                }.`
              : "Log trades with the context around them, or import a CSV. Everything stays in this browser."}
          </p>
        </div>
        <div className={`${styles.actions} no-print`}>
          <button type="button" className={panel === "trade" ? styles.primary : styles.secondary} onClick={() => toggle("trade")} aria-expanded={panel === "trade"}>
            Log a trade
          </button>
          <button type="button" className={panel === "csv" ? styles.primary : styles.secondary} onClick={() => toggle("csv")} aria-expanded={panel === "csv"}>
            Import CSV
          </button>
          {entries.length ? (
            <button type="button" className={styles.secondary} onClick={() => window.print()}>
              Print report
            </button>
          ) : null}
        </div>
      </div>

      {panel ? (
        <div className={`container no-print ${styles.panelWrap}`}>
          <section className={`${report.card} ${styles.panel}`} aria-label={panel === "trade" ? "Log a trade" : "Import a CSV"}>
            <header className={report.cardHead}>
              <h2>{panel === "trade" ? "Capture the context, not just the numbers" : "Import trades from a CSV"}</h2>
            </header>
            {panel === "trade" ? (
              <TradeForm onSave={(entry) => add([entry])} onCancel={() => setPanel(null)} />
            ) : (
              <CsvImport onImport={add} onCancel={() => setPanel(null)} />
            )}
          </section>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="container">
          <section className={`${report.card} ${report.emptyState}`}>
            <h2>Your journal is empty</h2>
            <p>
              Analytics and insights only ever come from trades you record, so nothing is invented. Log your first trade
              or import a file to get started.
            </p>
            <button type="button" className={styles.primary} onClick={() => setPanel("trade")}>
              Log your first trade
            </button>
          </section>
        </div>
      ) : (
        <>
          <div className={`container ${styles.rangeRow} no-print`} role="group" aria-label="Report period">
            {RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.rangeChip}
                aria-pressed={range === option.id}
                onClick={() => {
                  setRange(option.id);
                  setNow(Date.now());
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="container">
              <section className={`${report.card} ${report.emptyState}`}>
                <h2>No trades in this period</h2>
                <p>Pick a longer period to see your other entries.</p>
              </section>
            </div>
          ) : (
            <ReportView report={journalReport} hideHeader hideRecent extra={<Behaviour patterns={patterns} />} />
          )}

          <div className={`container ${styles.entries}`}>
            <section className={report.card}>
              <header className={`${report.cardHead} ${styles.entriesHead}`}>
                <div>
                  <h2>Journal entries</h2>
                  <p>Everything you have recorded, newest first.</p>
                </div>
                <button
                  type="button"
                  className={`${styles.danger} no-print`}
                  onClick={() => {
                    if (window.confirm(`Delete all ${entries.length} journal entries from this browser? This cannot be undone.`)) clear();
                  }}
                >
                  Clear journal
                </button>
              </header>
              <EntriesTable entries={visible} onRemove={remove} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
