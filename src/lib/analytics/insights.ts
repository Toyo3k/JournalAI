import { formatPercent, formatUsd } from "../format";
import type { AssetStat, Bucket, Capabilities, ClosedTrade, Insight, SideStat, Summary } from "./types";

const MIN_TRADES = 20;
const MIN_BUCKET = 5;
const MAX_INSIGHTS = 8;

interface Input {
  summary: Summary;
  trades: ClosedTrade[];
  assets: AssetStat[];
  sides: SideStat[];
  hours: Bucket[];
  capabilities: Capabilities;
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Average position size after a loss versus after a win, or null without enough data. */
function sizeAfterLoss(trades: ClosedTrade[]): { afterLoss: number; afterWin: number; ratio: number } | null {
  const afterLoss: number[] = [];
  const afterWin: number[] = [];
  for (let i = 1; i < trades.length; i++) {
    const previous = trades[i - 1];
    if (previous.pnl < 0) afterLoss.push(trades[i].notional);
    else if (previous.pnl > 0) afterWin.push(trades[i].notional);
  }
  if (afterLoss.length < 8 || afterWin.length < 8) return null;
  const lossAvg = average(afterLoss);
  const winAvg = average(afterWin);
  if (winAvg === 0) return null;
  return { afterLoss: lossAvg, afterWin: winAvg, ratio: lossAvg / winAvg };
}

function hourRange(bucket: Bucket): string {
  const hour = Number(bucket.key);
  return `${bucket.label}:00 and ${String((hour + 1) % 24).padStart(2, "0")}:00 UTC`;
}

/**
 * Turns the numbers into plain-language observations. Every insight is derived
 * from the wallet's own fills and states the figures it is based on, so
 * nothing here is generic advice.
 */
export function generateInsights({ summary, trades, assets, sides, hours, capabilities }: Input): Insight[] {
  if (summary.tradeCount === 0) return [];

  const insights: Insight[] = [];
  const gross = summary.netPnl + summary.fees;

  if (summary.tradeCount < MIN_TRADES) {
    insights.push({
      id: "sample-size",
      tone: "neutral",
      title: "Small sample",
      stat: String(summary.tradeCount),
      body: `Only ${summary.tradeCount} closed trades were found. Treat every figure here as a starting point rather than a verdict. Patterns need roughly ${MIN_TRADES}+ trades to mean much.`,
    });
  }

  // Overall edge
  if (summary.tradeCount >= 10) {
    if (summary.expectancy > 0 && (summary.profitFactor === null || summary.profitFactor >= 1.2)) {
      insights.push({
        id: "edge",
        tone: "positive",
        title: "Positive expectancy",
        stat: `${formatUsd(summary.expectancy, { signed: true })}/trade`,
        body: `The average closed trade returned ${formatUsd(summary.expectancy, { signed: true })} after fees${
          summary.profitFactor ? `, with a profit factor of ${summary.profitFactor.toFixed(2)}` : ""
        }. That is the number to protect: changes that lower it need a strong reason.`,
      });
    } else if (summary.expectancy < 0) {
      insights.push({
        id: "negative-edge",
        tone: "caution",
        title: "Negative expectancy",
        stat: `${formatUsd(summary.expectancy, { signed: true })}/trade`,
        body: `The average closed trade lost ${formatUsd(Math.abs(summary.expectancy))} after fees. At this rate more activity means more losses, so the first fix is usually taking fewer, better trades rather than more.`,
      });
    }
  }

  // Win rate against the win rate this payoff structure requires
  if (summary.payoffRatio !== null && summary.wins + summary.losses >= 10) {
    const breakeven = 1 / (1 + summary.payoffRatio);
    if (summary.winRate < breakeven) {
      insights.push({
        id: "breakeven-gap",
        tone: "caution",
        title: "Win rate is below breakeven",
        stat: `${formatPercent(summary.winRate, 0)} vs ${formatPercent(breakeven, 0)}`,
        body: `Winners average ${formatUsd(summary.avgWin)} and losers ${formatUsd(summary.avgLoss)}, so you need to win ${formatPercent(breakeven, 0)} of the time to break even. You win ${formatPercent(summary.winRate, 0)}. Either the wins must get bigger or the losses smaller.`,
      });
    }
  }

  // Loss size
  if (summary.payoffRatio !== null && summary.payoffRatio < 0.7 && summary.losses >= 5) {
    insights.push({
      id: "loss-size",
      tone: "caution",
      title: "Losses outweigh wins",
      stat: `${(1 / summary.payoffRatio).toFixed(1)}x`,
      body: `Your average loss is ${(1 / summary.payoffRatio).toFixed(1)} times your average win. This pattern often points to holding losers too long or taking profit too early.`,
    });
  } else if (summary.payoffRatio !== null && summary.payoffRatio >= 1.5 && summary.wins >= 5) {
    insights.push({
      id: "payoff",
      tone: "positive",
      title: "Winners run further than losers",
      stat: `${summary.payoffRatio.toFixed(1)}x`,
      body: `Your average win (${formatUsd(summary.avgWin)}) is ${summary.payoffRatio.toFixed(1)} times your average loss (${formatUsd(summary.avgLoss)}). That payoff cushion lets you be wrong often and still come out ahead.`,
    });
  }

  // Tilt: sizing up after a loss
  const tilt = sizeAfterLoss(trades);
  if (tilt && tilt.ratio >= 1.25) {
    insights.push({
      id: "size-after-loss",
      tone: "caution",
      title: "You size up after losses",
      stat: `${tilt.ratio.toFixed(1)}x`,
      body: `Trades that follow a loss average ${formatUsd(tilt.afterLoss, { compact: true })} in size, against ${formatUsd(tilt.afterWin, { compact: true })} after a win. Increasing size while chasing a loss back is a classic tilt pattern.`,
    });
  } else if (tilt && tilt.ratio <= 0.75) {
    insights.push({
      id: "size-after-loss",
      tone: "positive",
      title: "You de-risk after losses",
      stat: `${tilt.ratio.toFixed(1)}x`,
      body: `Trades that follow a loss are ${formatUsd(tilt.afterLoss, { compact: true })} on average, smaller than the ${formatUsd(tilt.afterWin, { compact: true })} after a win. Cutting size when things go wrong is a disciplined habit.`,
    });
  }

  // Fees
  if (capabilities.fees && summary.fees > 0 && gross > 0 && summary.netPnl <= 0) {
    insights.push({
      id: "fees-flip",
      tone: "caution",
      title: "Fees turn a gross profit into a loss",
      stat: formatUsd(summary.fees, { compact: true }),
      body: `Before fees the wallet made ${formatUsd(gross, { signed: true })}. ${formatUsd(summary.fees)} in fees took it to ${formatUsd(summary.netPnl, { signed: true })}. Trading less often would change the outcome.`,
    });
  } else if (capabilities.fees && summary.fees > 0 && gross > 0 && summary.fees / gross > 0.25) {
    insights.push({
      id: "fee-drag",
      tone: "caution",
      title: "Fees are a heavy drag",
      stat: formatPercent(summary.fees / gross, 0),
      body: `Fees consumed ${formatPercent(summary.fees / gross, 0)} of gross profit (${formatUsd(summary.fees)} of ${formatUsd(gross)}). Every swap pays gas, so fewer, larger trades cost less than many small ones.`,
    });
  }

  // Concentration
  const totalVolume = assets.reduce((total, asset) => total + asset.volume, 0);
  const top = assets[0];
  if (top && totalVolume > 0 && assets.length > 1 && top.volume / totalVolume > 0.6) {
    insights.push({
      id: "concentration",
      tone: "neutral",
      title: `Heavily concentrated in ${top.coin}`,
      stat: formatPercent(top.volume / totalVolume, 0),
      body: `${formatPercent(top.volume / totalVolume, 0)} of your traded volume is in ${top.coin}. That is fine if it is your edge, but a single market now drives most of your results.`,
    });
  }

  // Worst and best markets
  const ranked = assets.filter((asset) => asset.trades >= MIN_BUCKET).sort((a, b) => a.pnl - b.pnl);
  const worstAsset = ranked[0];
  if (worstAsset && worstAsset.pnl < 0 && summary.netPnl !== worstAsset.pnl) {
    insights.push({
      id: "worst-asset",
      tone: "caution",
      title: `${worstAsset.coin} is your biggest leak`,
      stat: formatUsd(worstAsset.pnl, { compact: true, signed: true }),
      body: `${worstAsset.coin} lost ${formatUsd(Math.abs(worstAsset.pnl))} across ${worstAsset.trades} trades at a ${formatPercent(worstAsset.winRate, 0)} win rate. Reviewing those trades, or sitting the market out, is the highest-leverage fix.`,
    });
  }
  const bestAsset = ranked[ranked.length - 1];
  if (bestAsset && bestAsset.pnl > 0 && bestAsset !== worstAsset) {
    insights.push({
      id: "best-asset",
      tone: "positive",
      title: `${bestAsset.coin} is your strongest market`,
      stat: formatUsd(bestAsset.pnl, { compact: true, signed: true }),
      body: `${bestAsset.coin} produced ${formatUsd(bestAsset.pnl)} over ${bestAsset.trades} trades with a ${formatPercent(bestAsset.winRate, 0)} win rate. It is where your process is working best so far.`,
    });
  }

  // Time of day
  const activeHours = hours.filter((bucket) => bucket.trades >= MIN_BUCKET);
  if (activeHours.length >= 3) {
    const worstHour = [...activeHours].sort((a, b) => a.pnl - b.pnl)[0];
    if (worstHour.pnl < 0) {
      insights.push({
        id: "worst-hour",
        tone: "caution",
        title: "A costly time of day",
        stat: `${worstHour.label}:00`,
        body: `Trades closed between ${hourRange(worstHour)} lost ${formatUsd(Math.abs(worstHour.pnl))} over ${worstHour.trades} trades. If that window matches tired or rushed sessions, consider skipping it.`,
      });
    }
  }

  // Direction bias
  const [long, short] = sides;
  if (capabilities.shorts && long.trades >= 10 && short.trades >= 10) {
    const weaker = long.pnl < short.pnl ? long : short;
    const stronger = weaker === long ? short : long;
    if (weaker.pnl < 0 && stronger.pnl > 0) {
      insights.push({
        id: "side-bias",
        tone: "caution",
        title: `${weaker.side} trades are dragging results`,
        body: `${stronger.side}s made ${formatUsd(stronger.pnl, { signed: true })} while ${weaker.side.toLowerCase()}s lost ${formatUsd(Math.abs(weaker.pnl))}. Your read of the market seems to be sharper in one direction.`,
      });
    }
  }

  // Streaks
  if (summary.longestLossStreak >= 5) {
    insights.push({
      id: "loss-streak",
      tone: "caution",
      title: "Long losing streaks",
      stat: String(summary.longestLossStreak),
      body: `Your longest losing run was ${summary.longestLossStreak} trades in a row. A pre-set daily loss limit or a forced break after three losses can keep a bad run from compounding.`,
    });
  }

  return insights.slice(0, MAX_INSIGHTS);
}
