"use client";

import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import styles from "./interactive.module.css";

interface Tip {
  x: number;
  y: number;
  side: "left" | "right" | "center";
  lines: string[];
}

/**
 * Styled hover tooltips for a server-rendered chart whose elements carry `data-tip`
 * ("Title|value|detail"). The value is coloured by its sign.
 */
export function TipLayer({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest("[data-tip]") : null;
    if (!target || !wrap.current) return setTip(null);
    const cell = target.getBoundingClientRect();
    const box = wrap.current.getBoundingClientRect();
    const x = cell.left + cell.width / 2 - box.left;
    setTip({
      x,
      y: cell.top - box.top,
      side: x > box.width - 110 ? "left" : x < 110 ? "right" : "center",
      lines: (target.getAttribute("data-tip") ?? "").split("|"),
    });
  }

  const [title, value, detail] = tip?.lines ?? [];
  return (
    <div ref={wrap} className={styles.tipLayer} onPointerMove={onPointerMove} onPointerLeave={() => setTip(null)}>
      {children}
      {tip ? (
        <div className={`${styles.tip} ${styles.cellTip}`} style={{ left: tip.x, top: tip.y }} data-side={tip.side} aria-hidden="true">
          <span className={styles.tipDate}>{title}</span>
          {value ? <b className={`num ${value.startsWith("+") ? "pos" : value.startsWith("-") ? "neg" : styles.plain}`}>{value}</b> : null}
          {detail ? <span className={styles.tipDetail}>{detail}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
