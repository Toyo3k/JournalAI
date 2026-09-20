import type { Insight } from "@/lib/analytics/types";
import styles from "./report.module.css";

const TONE_LABEL = { positive: "Working", caution: "Watch", neutral: "Note" } as const;

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) {
    return <p className={styles.muted}>Not enough closed trades to draw insights yet.</p>;
  }

  return (
    <ul className={styles.insights}>
      {insights.map((insight) => (
        <li key={insight.id} className={styles.insight} data-tone={insight.tone}>
          <div className={styles.insightHead}>
            <span className={styles.insightTag}>{TONE_LABEL[insight.tone]}</span>
            {insight.stat ? <span className={`${styles.insightStat} num`}>{insight.stat}</span> : null}
          </div>
          <h3>{insight.title}</h3>
          <p>{insight.body}</p>
        </li>
      ))}
    </ul>
  );
}
