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
  { coin: "TSLA", price: 340, edge: 0.1 },
  { coin: "NVDA", price: 175, edge: 0.05 },
  { coin: "AAPL", price: 235, edge: -0.04 },
  { coin: "AMZN", price: 210, edge: -0.14 },
];

const HOURS = [1, 2, 8, 9, 10, 13, 14, 14, 15, 16, 20, 21, 22];
const DAY_MS = 86_400_000;
/** Gas on Robinhood Chain is cheap, so a swap costs cents rather than dollars. */
const GAS_MIN = 0.03;
const GAS_RANGE = 0.35;

export type DemoProfile = "active" | "steady";

interface Profile {
  seed: number;
  trades: number;
  /** Relative chance of picking each market, in MARKETS order. */
  weights: number[];
  notional: [min: number, range: number];
  baseWinChance: number;
  winMove: [min: number, range: number];
  lossMove: [min: number, range: number];
  /** Position size multiplier applied after a loss. */
  tilt: [min: number, range: number] | null;
}

const PROFILES: Record<DemoProfile, Profile> = {
  // Trades often and big, and sizes up after losses.
  active: { seed: 42, trades: 180, weights: [4, 3, 2, 1], notional: [4_000, 9_000], baseWinChance: 0.56, winMove: [0.006, 0.026], lossMove: [0.005, 0.02], tilt: [1.4, 0.5] },
  // Trades less, smaller and steadier, with tighter losses and no revenge sizing.
  steady: { seed: 7, trades: 110, weights: [1, 4, 3, 2], notional: [1_500, 3_000], baseWinChance: 0.62, winMove: [0.006, 0.016], lossMove: [0.003, 0.008], tilt: null },
};

/**
 * Builds a believable synthetic swap history in the same shape the Robinhood
 * Chain adapter produces, so the sample reports exercise the exact analysis
 * pipeline. Each profile has intentional habits for the insights to find, such
 * as sizing up after losses, weak markets and a costly late-evening window.
 */
export function generateDemoFills(profile: DemoProfile = "active", end = Date.UTC(2026, 8, 1)): Fill[] {
  const config = PROFILES[profile];
  const random = mulberry32(config.seed);
  const fills: Fill[] = [];
  const totalWeight = config.weights.reduce((sum, weight) => sum + weight, 0);
  const pick = () => {
    let roll = random() * totalWeight;
    for (const [index, market] of MARKETS.entries()) {
      roll -= config.weights[index];
      if (roll <= 0) return market;
    }
    return MARKETS[0];
  };

  // Close times are drawn up front and sorted so trade order matches time order.
  const closeTimes = Array.from({ length: config.trades }, (_, i) => {
    const daysAgo = 60 - (i / config.trades) * 60;
    const hour = HOURS[Math.floor(random() * HOURS.length)];
    return end - daysAgo * DAY_MS + hour * 3_600_000 + Math.floor(random() * 3_000_000);
  }).sort((a, b) => a - b);

  let hashCounter = 1;
  const hash = () => `0x${(hashCounter++).toString(16).padStart(64, "0")}`;
  let lastWasLoss: boolean = false;

  for (let i = 0; i < config.trades; i++) {
    const market = pick();
    const closeTime = closeTimes[i];
    const hour = new Date(closeTime).getUTCHours();

    const baseNotional = config.notional[0] + random() * config.notional[1];
    const tilted = lastWasLoss && config.tilt;
    const notional: number = tilted ? baseNotional * (config.tilt![0] + random() * config.tilt![1]) : baseNotional;
    const price = market.price * (0.92 + random() * 0.16);
    const size = notional / price;

    const winChance = config.baseWinChance + market.edge - (hour === 22 || hour === 21 ? 0.14 : 0);
    const win = random() < winChance;
    const move = win ? config.winMove[0] + random() * config.winMove[1] : -(config.lossMove[0] + random() * config.lossMove[1]);
    const pnl: number = notional * move * (win ? 1 : tilted ? 1.1 : 1);

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
      openedAt: openTime,
    });

    lastWasLoss = pnl - closeFee < 0;
  }

  return fills;
}
