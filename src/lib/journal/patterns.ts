import { formatPercent, formatUsd } from "../format";
import type { Insight } from "../analytics/types";
import { NOT_RECORDED, UNSPECIFIED } from "./types";
import type { JournalEntry } from "./types";

/** A group needs a few trades before a comparison says anything at all. */
const MIN_GROUP = 3;

export interface GroupStat {
  name: string;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface JournalPatterns {
  emotions: GroupStat[];
  setups: GroupStat[];
  rules: GroupStat[];
  /** Share of trades with a recorded answer that followed the plan, or null when none were recorded. */
  adherence: { followed: number; recorded: number } | null;
  insights: Insight[];
}

function group(entries: JournalEntry[], pick: (entry: JournalEntry) => string, fallback: string): GroupStat[] {
  const map = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const name = pick(entry).trim() || fallback;
    map.set(name, [...(map.get(name) ?? []), entry]);
  }
  return [...map.entries()]
    .map(([name, items]) => {
      const decided = items.filter((item) => item.pnl !== 0);
      return {
        name,
        trades: items.length,
        pnl: items.reduce((total, item) => total + item.pnl, 0),
        winRate: decided.length ? decided.filter((item) => item.pnl > 0).length / decided.length : 0,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}

const usable = (stats: GroupStat[], skip: string) => stats.filter((stat) => stat.trades >= MIN_GROUP && stat.name !== skip);

export function journalPatterns(entries: JournalEntry[]): JournalPatterns {
  const emotions = group(entries, (entry) => entry.emotion, UNSPECIFIED);
  const setups = group(entries, (entry) => entry.setup, UNSPECIFIED);
  const rules = group(entries, (entry) => entry.rules, NOT_RECORDED);

  const recorded = rules.filter((stat) => stat.name !== NOT_RECORDED).reduce((total, stat) => total + stat.trades, 0);
  const followed = rules.find((stat) => stat.name === "Followed plan")?.trades ?? 0;
  const adherence = recorded ? { followed, recorded } : null;

  const insights: Insight[] = [];

  const byPnl = [...usable(emotions, UNSPECIFIED)].sort((a, b) => a.pnl - b.pnl);
  const worstEmotion = byPnl[0];
  const bestEmotion = byPnl[byPnl.length - 1];
  if (worstEmotion && worstEmotion.pnl < 0) {
    insights.push({
      id: "j-worst-emotion",
      tone: "caution",
      title: `Watch your ${worstEmotion.name.toLowerCase()} entries`,
      stat: formatUsd(worstEmotion.pnl, { signed: true, compact: true }),
      body: `${worstEmotion.trades} trades entered while ${worstEmotion.name.toLowerCase()} produced ${formatUsd(worstEmotion.pnl, { signed: true })} at a ${formatPercent(worstEmotion.winRate, 0)} win rate. Check whether that state changed your sizing or the quality of the entry.`,
    });
  }
  if (bestEmotion && bestEmotion.pnl > 0 && bestEmotion !== worstEmotion) {
    insights.push({
      id: "j-best-emotion",
      tone: "positive",
      title: `You trade best when ${bestEmotion.name.toLowerCase()}`,
      stat: formatUsd(bestEmotion.pnl, { signed: true, compact: true }),
      body: `${bestEmotion.trades} ${bestEmotion.name.toLowerCase()} trades made ${formatUsd(bestEmotion.pnl, { signed: true })} at a ${formatPercent(bestEmotion.winRate, 0)} win rate. Notice what is different about your process in that state.`,
    });
  }

  // Plan adherence: compare trades that stuck to the plan against the rest.
  const stuck = rules.find((stat) => stat.name === "Followed plan");
  const broke = rules.filter((stat) => stat.name !== "Followed plan" && stat.name !== NOT_RECORDED);
  const brokeTrades = broke.reduce((total, stat) => total + stat.trades, 0);
  const brokePnl = broke.reduce((total, stat) => total + stat.pnl, 0);
  if (stuck && stuck.trades >= MIN_GROUP && brokeTrades >= MIN_GROUP) {
    const brokeWins = broke.reduce((total, stat) => total + stat.winRate * stat.trades, 0) / brokeTrades;
    const stuckAvg = stuck.pnl / stuck.trades;
    const brokeAvg = brokePnl / brokeTrades;
    if (stuckAvg > brokeAvg) {
      insights.push({
        id: "j-plan-gap",
        tone: "caution",
        title: "Breaking the plan costs you",
        stat: `${formatUsd(stuckAvg - brokeAvg, { compact: true })}/trade`,
        body: `Trades that followed your plan averaged ${formatUsd(stuckAvg, { signed: true })} and won ${formatPercent(stuck.winRate, 0)}. When you deviated they averaged ${formatUsd(brokeAvg, { signed: true })} and won ${formatPercent(brokeWins, 0)}.`,
      });
    } else {
      insights.push({
        id: "j-plan-gap",
        tone: "neutral",
        title: "Your plan is not beating your instincts yet",
        body: `Trades that deviated from the plan averaged ${formatUsd(brokeAvg, { signed: true })}, against ${formatUsd(stuckAvg, { signed: true })} when you followed it. That is worth a look: either the plan needs work or the sample is still small.`,
      });
    }
  }
  if (adherence && adherence.recorded >= 5 && adherence.followed / adherence.recorded < 0.6) {
    insights.push({
      id: "j-low-adherence",
      tone: "caution",
      title: "Low plan adherence",
      stat: formatPercent(adherence.followed / adherence.recorded, 0),
      body: `You followed your plan on ${adherence.followed} of ${adherence.recorded} trades. Discipline is the input you control, so it is usually the best place to start.`,
    });
  }

  const setupsByPnl = [...usable(setups, UNSPECIFIED)].sort((a, b) => a.pnl - b.pnl);
  const worstSetup = setupsByPnl[0];
  const bestSetup = setupsByPnl[setupsByPnl.length - 1];
  if (bestSetup && bestSetup.pnl > 0) {
    insights.push({
      id: "j-best-setup",
      tone: "positive",
      title: `${bestSetup.name} is your strongest setup`,
      stat: formatUsd(bestSetup.pnl, { signed: true, compact: true }),
      body: `${bestSetup.trades} trades made ${formatUsd(bestSetup.pnl, { signed: true })} at a ${formatPercent(bestSetup.winRate, 0)} win rate. Keep collecting examples before treating it as a proven edge.`,
    });
  }
  if (worstSetup && worstSetup.pnl < 0 && worstSetup !== bestSetup) {
    insights.push({
      id: "j-worst-setup",
      tone: "caution",
      title: `${worstSetup.name} trades are losing money`,
      stat: formatUsd(worstSetup.pnl, { signed: true, compact: true }),
      body: `${worstSetup.trades} trades lost ${formatUsd(Math.abs(worstSetup.pnl))} at a ${formatPercent(worstSetup.winRate, 0)} win rate. Review the notes on those entries for what they had in common.`,
    });
  }

  return { emotions, setups, rules, adherence, insights };
}
