"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import { CHAIN_LABELS, MAX_WALLETS, parseAddressList, reportHref } from "@/lib/address";
import type { ParsedAddress } from "@/lib/address";
import { shortenAddress } from "@/lib/format";
import styles from "./home.module.css";

interface AddressFormProps {
  variant?: "hero" | "compact";
  /** One address, or several separated by commas. */
  initialValue?: string;
}

/** Merges new entries into the list, skipping any already there. */
function merge(current: ParsedAddress[], incoming: ParsedAddress[]): ParsedAddress[] {
  const seen = new Set(current.map((entry) => entry.value));
  return [...current, ...incoming.filter((entry) => !seen.has(entry.value))];
}

/**
 * Takes one or several wallet addresses on any supported chain. Each becomes a chip labelled
 * with the chain detected from its format; entries that aren't valid stay visible and flagged.
 * One wallet opens its report, several open a combined one.
 */
export function AddressForm({ variant = "hero", initialValue = "" }: AddressFormProps) {
  const router = useRouter();
  const [chips, setChips] = useState<ParsedAddress[]>(() => parseAddressList(initialValue));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();

  function commit(text: string) {
    const parsed = parseAddressList(text);
    if (parsed.length) setChips((current) => merge(current, parsed));
    setDraft("");
    setError(null);
  }

  function onChange(value: string) {
    // Typing a separator turns everything before it into chips.
    if (/[\s,;]/.test(value)) commit(value);
    else setDraft(value);
    if (error) setError(null);
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    // A single-line input would glue pasted lines together, so split the paste ourselves.
    event.preventDefault();
    commit(`${draft} ${event.clipboardData.getData("text")}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !draft && chips.length) {
      event.preventDefault();
      setChips((current) => current.slice(0, -1));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const all = merge(chips, parseAddressList(draft));
    setChips(all);
    setDraft("");

    if (!all.length) return setError("Enter a wallet address to analyse.");
    if (all.some((entry) => !entry.chain)) {
      return setError("Some entries aren't valid addresses. Use Robinhood Chain (0x followed by 40 characters) or Solana addresses, and remove the highlighted ones.");
    }
    if (all.length > MAX_WALLETS) return setError(`You can analyse up to ${MAX_WALLETS} wallets at once. Remove ${all.length - MAX_WALLETS}.`);

    setError(null);
    startTransition(() => router.push(reportHref(all.map((entry) => entry.value))));
  }

  const count = merge(chips, parseAddressList(draft)).filter((entry) => entry.chain).length;
  const label = pending ? "Analysing" : count > 1 ? `Analyse ${count} wallets` : "Analyse wallet";
  const placeholder = chips.length
    ? "Add another wallet"
    : variant === "compact"
      ? "Wallet addresses"
      : "Paste one or more Robinhood Chain or Solana wallets";

  return (
    <form className={`${styles.form} ${variant === "compact" ? styles.compact : ""}`} onSubmit={onSubmit} noValidate>
      <div className={styles.field} data-invalid={error ? "true" : undefined} onClick={() => input.current?.focus()}>
        <div className={styles.entries}>
          {chips.length ? (
            <ul className={styles.chips} aria-label="Wallets to analyse">
              {chips.map((chip) => (
                <li key={chip.value} className={styles.chip} data-valid={chip.chain ? "true" : "false"} title={chip.value}>
                  <span className={styles.chipChain}>{chip.chain ? CHAIN_LABELS[chip.chain] : "Not valid"}</span>
                  <span className="mono">{chip.value.length > 16 ? shortenAddress(chip.value) : chip.value}</span>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={`Remove ${chip.value}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setChips((current) => current.filter((entry) => entry.value !== chip.value));
                      setError(null);
                      input.current?.focus();
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label htmlFor={inputId} className="sr-only">
            Wallet addresses
          </label>
          <input
            ref={input}
            id={inputId}
            className={`${styles.input} mono`}
            value={draft}
            onChange={(event) => onChange(event.target.value)}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            onBlur={() => draft && commit(draft)}
            placeholder={placeholder}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={[error ? errorId : "", variant === "hero" ? hintId : ""].filter(Boolean).join(" ") || undefined}
          />
        </div>
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
          {label}
        </button>
      </div>
      {variant === "hero" && !error ? (
        <p id={hintId} className={styles.hint}>
          Up to {MAX_WALLETS} wallets, mixed chains welcome. Separate them with commas, spaces or new lines.
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
