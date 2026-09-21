import type { Fill } from "../analytics/types";

/** Small deterministic PRNG so the sample report is identical on every render. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARKETS = [
  { coin: "TSLA", price: 340, weight: 4, edge: 0.1 },
  { coin: "NVDA", price: 175, weight: 3, edge: 0.05 },
  { coin: "AAPL", price: 235, weight: 2, edge: -0.04 },
  { coin: "AMZN", price: 210, weight: 1, edge: -0.14 },
];

const HOURS = [1, 2, 8, 9, 10, 13, 14, 14, 15, 16, 20, 21, 22];
const DAY_MS = 86_400_000;
/** Gas on Robinhood Chain is cheap, so a swap costs cents rather than dollars. */
const GAS_MIN = 0.03;
const GAS_RANGE = 0.35;

/**
 * Builds a believable synthetic swap history in the same shape the Robinhood
 * Chain adapter produces, so the sample report exercises the exact analysis
 * pipeline. The behaviour is intentional: bigger size after losses, a weak
 * spot in AMZN and AAPL, and a costly late-evening window.
 */
export function generateDemoFills(end = Date.UTC(2026, 8, 1), tradeCount = 180): Fill[] {
  const random = mulberry32(42);
  const fills: Fill[] = [];
  const pick = () => {
    const total = MARKETS.reduce((sum, market) => sum + market.weight, 0);
    let roll = random() * total;
    for (const market of MARKETS) {
      roll -= market.weight;
      if (roll <= 0) return market;
    }
    return MARKETS[0];
  };

  // Close times are drawn up front and sorted so trade order matches time order.
  const closeTimes = Array.from({ length: tradeCount }, (_, i) => {
    const daysAgo = 60 - (i / tradeCount) * 60;
    const hour = HOURS[Math.floor(random() * HOURS.length)];
    return end - daysAgo * DAY_MS + hour * 3_600_000 + Math.floor(random() * 3_000_000);
  }).sort((a, b) => a - b);

  let hashCounter = 1;
  const hash = () => `0x${(hashCounter++).toString(16).padStart(64, "0")}`;
  let lastWasLoss: boolean = false;

  for (let i = 0; i < tradeCount; i++) {
    const market = pick();
    const closeTime = closeTimes[i];
    const hour = new Date(closeTime).getUTCHours();

    const baseNotional = 4_000 + random() * 9_000;
    const notional: number = lastWasLoss ? baseNotional * (1.4 + random() * 0.5) : baseNotional;
    const price = market.price * (0.92 + random() * 0.16);
    const size = notional / price;

    const winChance = 0.56 + market.edge - (hour === 22 || hour === 21 ? 0.14 : 0);
    const win = random() < winChance;
    const move = win ? 0.006 + random() * 0.026 : -(0.005 + random() * 0.02);
    const pnl: number = notional * move * (win ? 1 : lastWasLoss ? 1.1 : 1);

    const openFee = GAS_MIN + random() * GAS_RANGE;
    const closeFee = GAS_MIN + random() * GAS_RANGE;
    const openTime = closeTime - (20 + random() * 600) * 60_000;
    const openHash = hash();
    const closeHash = hash();

    fills.push({
      id: `${openHash}:buy`,
      coin: market.coin,
      price,
      size,
      isBuy: true,
      time: openTime,
      dir: "Open Long",
      closedPnl: 0,
      fee: openFee,
      orderId: openHash,
    });
    fills.push({
      id: `${closeHash}:sell`,
      coin: market.coin,
      price: price * (1 + move),
      size,
      isBuy: false,
      time: closeTime,
      dir: "Close Long",
      closedPnl: pnl,
      fee: closeFee,
      orderId: closeHash,
    });

    lastWasLoss = pnl - closeFee < 0;
  }

  return fills;
}
