"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { parseMoney } from "@/lib/journal/csv";
import { newId } from "@/lib/journal/storage";
import { DIRECTIONS, EMOTIONS, RULES, SETUPS } from "@/lib/journal/types";
import type { JournalEntry } from "@/lib/journal/types";
import styles from "./journal.module.css";

/** Value for a datetime-local input, which expects local time without a zone. */
function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

interface TradeFormProps {
  onSave: (entry: JournalEntry) => boolean;
  onCancel: () => void;
}

export function TradeForm({ onSave, onCancel }: TradeFormProps) {
  const id = useId();
  const [asset, setAsset] = useState("");
  const [direction, setDirection] = useState<string>(DIRECTIONS[0]);
  const [pnl, setPnl] = useState("");
  const [size, setSize] = useState("");
  const [setup, setSetup] = useState<string>(SETUPS[0]);
  const [emotion, setEmotion] = useState<string>(EMOTIONS[0]);
  const [rules, setRules] = useState<string>(RULES[0]);
  const [date, setDate] = useState(() => localInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseMoney(pnl);
    const notional = size.trim() ? Math.abs(parseMoney(size)) : 0;
    const closedAt = new Date(date);

    if (!asset.trim()) return setError("Add a ticker or market.");
    if (!Number.isFinite(value)) return setError("Enter the realized P&L as a number, for example 245.50 or -80.");
    if (!Number.isFinite(notional)) return setError("Position size should be a number, or leave it empty.");
    if (Number.isNaN(closedAt.getTime())) return setError("Choose when the trade was closed.");

    const saved = onSave({
      id: newId(),
      asset: asset.trim().toUpperCase(),
      direction: direction as JournalEntry["direction"],
      pnl: value,
      size: notional,
      setup,
      emotion,
      rules,
      notes: notes.trim(),
      date: closedAt.toISOString(),
    });
    if (!saved) return setError("This browser would not let us save. Check that storage is not blocked or full.");

    setAsset("");
    setPnl("");
    setSize("");
    setNotes("");
    setDate(localInputValue(new Date()));
    setError(null);
  }

  const field = (name: string) => `${id}-${name}`;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor={field("asset")}>Asset or ticker</label>
          <input id={field("asset")} value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="e.g. BTC, NVDA, ES" autoComplete="off" />
        </div>
        <div className={styles.field}>
          <label htmlFor={field("direction")}>Direction</label>
          <select id={field("direction")} value={direction} onChange={(e) => setDirection(e.target.value)}>
            {DIRECTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={field("pnl")}>Realized P&amp;L (USD)</label>
          <input id={field("pnl")} value={pnl} onChange={(e) => setPnl(e.target.value)} inputMode="decimal" placeholder="e.g. 245.50 or -80" autoComplete="off" />
        </div>
        <div className={styles.field}>
          <label htmlFor={field("size")}>
            Position size (USD) <span>optional</span>
          </label>
          <input id={field("size")} value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" placeholder="e.g. 5000" autoComplete="off" />
        </div>
        <div className={styles.field}>
          <label htmlFor={field("setup")}>Setup</label>
          <select id={field("setup")} value={setup} onChange={(e) => setSetup(e.target.value)}>
            {SETUPS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={field("emotion")}>Emotion at entry</label>
          <select id={field("emotion")} value={emotion} onChange={(e) => setEmotion(e.target.value)}>
            {EMOTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={field("rules")}>Rule adherence</label>
          <select id={field("rules")} value={rules} onChange={(e) => setRules(e.target.value)}>
            {RULES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={field("date")}>Closed at</label>
          <input id={field("date")} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor={field("notes")}>
            Thesis and takeaways <span>optional</span>
          </label>
          <textarea
            id={field("notes")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was the idea? What would you repeat or change?"
            rows={3}
          />
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.formActions}>
        <button type="submit" className={styles.primary}>
          Save trade
        </button>
        <button type="button" className={styles.ghost} onClick={onCancel}>
          Close
        </button>
      </div>
    </form>
  );
}
