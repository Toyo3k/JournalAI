"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./share.module.css";

interface ShareBarProps {
  /** Where the compare button should go, with this wallet already filled in. */
  compareHref: string;
  /** Used in the downloaded file name. */
  name: string;
}

type CardState = "idle" | "loading" | "ready" | "failed";

export function ShareBar({ compareHref, name }: ShareBarProps) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [status, setStatus] = useState<string | null>(null);
  const [card, setCard] = useState<CardState>("idle");
  // Bumped to retry a failed card, since the browser will not refetch an image whose URL has not changed.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const cardUrl = `${pathname}/opengraph-image${attempt ? `?retry=${attempt}` : ""}`;

  function announce(message: string) {
    setStatus(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 2500);
  }

  /** Older browsers and some embedded views lack the async clipboard API, so fall back to a selection copy. */
  function legacyCopy(text: string): boolean {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }

  async function copy() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      announce("Link copied");
    } catch {
      announce(legacyCopy(url) ? "Link copied" : "Could not copy. Copy the address bar link instead.");
    }
  }

  function openPreview() {
    // The card is only requested once someone asks to see it, because generating it can take a few seconds.
    if (card === "idle") setCard("loading");
    if (card === "failed") {
      setAttempt((value) => value + 1);
      setCard("loading");
    }
    dialog.current?.showModal();
  }

  return (
    <div className={`${styles.bar} no-print`}>
      <button type="button" className={styles.button} onClick={openPreview}>
        Share card
      </button>
      <button type="button" className={styles.button} onClick={copy}>
        Copy link
      </button>
      <Link className={styles.button} href={compareHref}>
        Compare
      </Link>
      <span className={styles.status} role="status">
        {status}
      </span>

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="share-card-title"
        // Clicking the dimmed area outside the panel lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.panel}>
          <header className={styles.head}>
            <div>
              <h2 id="share-card-title">Share card</h2>
              <p>This is the image people see when the link is shared.</p>
            </div>
            <button type="button" className={styles.close} onClick={() => dialog.current?.close()} aria-label="Close preview">
              ✕
            </button>
          </header>

          <div className={styles.preview} data-state={card}>
            {card !== "idle" && card !== "failed" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated PNG, so there is nothing for next/image to optimise
              <img
                key={attempt}
                src={cardUrl}
                alt="Share card preview showing this wallet's net P&L, win rate and equity curve"
                width={1200}
                height={630}
                onLoad={() => setCard("ready")}
                onError={() => setCard("failed")}
              />
            ) : null}
            {card === "loading" ? (
              <div className={styles.loading} role="status">
                <span className={styles.spinner} aria-hidden="true" />
                Generating your card
              </div>
            ) : null}
            {card === "failed" ? (
              <div className={styles.failed} role="alert">
                <p>The card could not be generated.</p>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => {
                    setAttempt((value) => value + 1);
                    setCard("loading");
                  }}
                >
                  Try again
                </button>
              </div>
            ) : null}
          </div>

          <footer className={styles.actions}>
            {card === "ready" ? (
              <a className={styles.primary} href={cardUrl} download={`journalai-${name}.png`}>
                Download PNG
              </a>
            ) : (
              <span className={styles.primary} aria-disabled="true">
                Download PNG
              </span>
            )}
            <button type="button" className={styles.button} onClick={copy}>
              Copy link
            </button>
            <span className={styles.status} role="status">
              {status}
            </span>
          </footer>
        </div>
      </dialog>
    </div>
  );
}
