"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { isValidAddress, normaliseAddress } from "@/lib/address";
import styles from "./home.module.css";

interface AddressFormProps {
  variant?: "hero" | "compact";
  initialValue?: string;
}

export function AddressForm({ variant = "hero", initialValue = "" }: AddressFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorId = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = normaliseAddress(value);

    if (!address) {
      setError("Enter a wallet address to analyse.");
      return;
    }
    if (!isValidAddress(address)) {
      setError("That doesn't look like a valid address. It should start with 0x followed by 40 characters.");
      return;
    }

    setError(null);
    startTransition(() => router.push(`/wallet/${address}`));
  }

  return (
    <form className={`${styles.form} ${variant === "compact" ? styles.compact : ""}`} onSubmit={onSubmit} noValidate>
      <div className={styles.field} data-invalid={error ? "true" : undefined}>
        <label htmlFor={`address-${variant}`} className="sr-only">
          Wallet address
        </label>
        <input
          id={`address-${variant}`}
          className={`${styles.input} mono`}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder={variant === "compact" ? "0x… wallet address" : "0x… paste a Robinhood Chain wallet address"}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
          {pending ? "Analysing" : "Analyse wallet"}
        </button>
      </div>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
