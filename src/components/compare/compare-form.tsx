"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import styles from "./compare.module.css";

/** The generated sample wallets can be used anywhere an address can. */
const SAMPLE_IDS = ["demo", "demo-2"];

const accepted = (value: string) => SAMPLE_IDS.includes(value) || isValidAddress(value);

export function CompareForm({ initialA = "", initialB = "" }: { initialA?: string; initialB?: string }) {
  const router = useRouter();
  const idA = useId();
  const idB = useId();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = normaliseAddress(a);
    const second = normaliseAddress(b);

    if (!first || !second) return setError("Enter two wallet addresses to compare.");
    if (!accepted(first) || !accepted(second)) return setError("Both entries must be a full wallet address starting with 0x, or a sample like demo.");
    if (first === second) return setError("Pick two different wallets.");

    setError(null);
    startTransition(() => router.push(`/compare?a=${first}&b=${second}`));
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.inputs}>
        <div className={styles.field} data-side="a">
          <label htmlFor={idA}>
            <i /> Wallet A
          </label>
          <input id={idA} value={a} onChange={(e) => setA(e.target.value)} placeholder="0x… address" className="mono" autoComplete="off" spellCheck={false} />
        </div>
        <button
          type="button"
          className={styles.swap}
          aria-label="Swap wallets"
          onClick={() => {
            setA(b);
            setB(a);
          }}
        >
          ⇄
        </button>
        <div className={styles.field} data-side="b">
          <label htmlFor={idB}>
            <i /> Wallet B
          </label>
          <input id={idB} value={b} onChange={(e) => setB(e.target.value)} placeholder="0x… address" className="mono" autoComplete="off" spellCheck={false} />
        </div>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Comparing" : "Compare wallets"}
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            setA("demo");
            setB("demo-2");
            setError(null);
          }}
        >
          Use sample wallets
        </button>
      </div>
    </form>
  );
}
