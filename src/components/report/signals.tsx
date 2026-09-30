import type { Insight } from "@/lib/analytics/types";
import { InsightsPanel } from "./insights-panel";
import styles from "./neural.module.css";

const TAGS = { positive: "Strength", caution: "Leak", neutral: "Note" } as const;

/** The strongest positive insight, then the leaks, up to three. The rest keep their original order. */
export function pickTopInsights(insights: Insight[]): { top: Insight[]; rest: Insight[] } {
  const positive = insights.find((insight) => insight.tone === "positive");
  const cautions = insights.filter((insight) => insight.tone === "caution");
  const top = (positive ? [positive, ...cautions.slice(0, 2)] : cautions.slice(0, 3)).slice(0, 3);
  // Fall back to whatever exists when there are no positives or leaks, such as a small sample note.
  if (!top.length) top.push(...insights.slice(0, 3));
  const chosen = new Set(top.map((insight) => insight.id));
  return { top, rest: insights.filter((insight) => !chosen.has(insight.id)) };
}

export function Signals({ insights }: { insights: Insight[] }) {
  const { top, rest } = pickTopInsights(insights);

  if (!top.length) return <p className={styles.chartHint}>Not enough closed trades to draw insights yet.</p>;

  return (
    <div className={styles.stack}>
      <div className={styles.constellation} data-count={top.length}>
        {top.length === 3 ? (
          <svg className={styles.links} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="signal-link" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--gain)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="var(--caution)" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path d="M160 20 C 330 0, 500 40, 500 20 S 670 0, 840 20" stroke="url(#signal-link)" strokeWidth="1.5" fill="none" />
          </svg>
        ) : null}
        {top.map((insight) => (
          <article key={insight.id} className={styles.signal} data-tone={insight.tone}>
            <span className={styles.signalNode} aria-hidden="true" />
            <div className={styles.signalHead}>
              <span className={styles.signalTag}>{TAGS[insight.tone]}</span>
              {insight.stat ? <span className={`${styles.signalStat} num`}>{insight.stat}</span> : null}
            </div>
            <h3>{insight.title}</h3>
            <p>{insight.body}</p>
          </article>
        ))}
      </div>

      {rest.length ? (
        <details className={styles.more}>
          <summary>
            {rest.length} more {rest.length === 1 ? "insight" : "insights"}
          </summary>
          <InsightsPanel insights={rest} />
        </details>
      ) : null}
    </div>
  );
}
