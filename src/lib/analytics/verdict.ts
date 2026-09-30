import type { Insight, NeuroScore, RiskStats, Summary } from "./types";

/** A score from fewer trades than this is shown, but flagged as low confidence. */
export const SCORE_MIN_TRADES = 20;

/** Short clauses for the verdict sentence, keyed by insight id. Insights without an entry are skipped. */
const CAUTION_PHRASES: Record<string, (insight: Insight) => string> = {
  "size-after-loss": () => "you size up after losses",
  "worst-hour": () => "one time of day keeps costing you",
  "worst-asset": (insight) => `${insight.title.split(" ")[0]} keeps leaking money`,
  "fees-flip": () => "fees turn your wins into a loss",
  "fee-drag": () => "fees eat into your gains",
  "loss-streak": () => "losing streaks run long",
  "loss-size": () => "your losses run bigger than your wins",
  "breakeven-gap": () => "you win too rarely for your payoff",
  "hold-losers": () => "you hold losers longer than winners",
  "hold-flips": () => "quick flips are costing you",
  "side-bias": (insight) => `your ${insight.title.split(" ")[0].toLowerCase()} trades drag results`,
  "risk-tail": () => "a few big losses do most of the damage",
  "stocks-offhours": () => "off-hours stock trades lose money",
  "j-worst-emotion": (insight) => {
    const emotion = /Watch your (.+) entries/.exec(insight.title)?.[1];
    return emotion ? `${emotion} entries cost you` : "one emotional state costs you";
  },
  "j-plan-gap": () => "breaking your plan costs you",
  "j-low-adherence": () => "you often trade off-plan",
};

/** One sentence: the headline result, then up to two habits behind it. */
export function buildVerdict(summary: Summary, insights: Insight[]): string {
  if (!summary.tradeCount) return "";

  const cautions = insights
    .filter((insight) => insight.tone === "caution" && CAUTION_PHRASES[insight.id])
    .slice(0, 2)
    .map((insight) => CAUTION_PHRASES[insight.id](insight));
  const habits = cautions.join(" and ");

  if (summary.netPnl > 0 && (summary.profitFactor === null || summary.profitFactor >= 1.2)) {
    return habits ? `Profitable with a real edge, but ${habits}.` : "Profitable with a real edge, with no clear leaks so far.";
  }
  if (summary.netPnl > 0) return habits ? `Only just profitable: ${habits}.` : "Only just profitable, with no clear leaks so far.";
  return habits ? `Losing money overall, mainly because ${habits}.` : "Losing money overall.";
}

const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)));

/**
 * The NeuroX score, 0 to 100. A first formula, kept in one place so it can be refined:
 * - Edge (40%): profit factor, from 0.5 (0) to 2.0 (100). No losses and some wins scores 100.
 * - Risk control (30%): net P&L as a multiple of the worst drawdown, from 0 to 5x.
 * - Discipline (30%): starts at 100, minus 30 for sizing up after losses, 15 for holding
 *   losers longer than winners, and 4 for each loss in the longest streak beyond three.
 */
export function buildScore(summary: Summary, risk: RiskStats | null, insights: Insight[]): NeuroScore | null {
  if (!summary.tradeCount) return null;

  const pf = summary.profitFactor;
  const edge = pf === null ? (summary.wins > 0 ? 100 : 0) : clamp(((pf - 0.5) / 1.5) * 100);

  const recovery = risk?.recoveryFactor ?? (summary.maxDrawdown > 0 ? summary.netPnl / summary.maxDrawdown : summary.netPnl > 0 ? 5 : 0);
  const riskControl = clamp((recovery / 5) * 100);

  const has = (id: string) => insights.some((insight) => insight.id === id && insight.tone === "caution");
  const tilt = has("size-after-loss");
  const holdsLosers = has("hold-losers");
  const discipline = clamp(100 - (tilt ? 30 : 0) - (holdsLosers ? 15 : 0) - Math.max(0, summary.longestLossStreak - 3) * 4);

  const disciplineNote = tilt ? "Sizes up after losses" : holdsLosers ? "Holds losers too long" : summary.longestLossStreak > 3 ? "Long losing streaks" : "Steady habits";

  return {
    value: clamp(edge * 0.4 + riskControl * 0.3 + discipline * 0.3),
    lowConfidence: summary.tradeCount < SCORE_MIN_TRADES,
    parts: [
      { key: "edge", label: "Edge", value: edge, blurb: pf === null ? "No losing trades" : `Profit factor ${pf.toFixed(2)}` },
      { key: "risk", label: "Risk control", value: riskControl, blurb: recovery > 0 ? `Made ${recovery.toFixed(1)}x its worst drawdown` : "Below its starting point" },
      { key: "discipline", label: "Discipline", value: discipline, blurb: disciplineNote },
    ],
  };
}
