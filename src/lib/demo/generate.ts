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
  { coin: "BTC", price: 96_000, weight: 4, edge: 0.08 },
  { coin: "ETH", price: 3_400, weight: 3, edge: 0.03 },
  { coin: "SOL", price: 190, weight: 2, edge: -0.05 },
  { coin: "HYPE", price: 32, weight: 1, edge: -0.12 },
];

const HOURS = [1, 2, 8, 9, 10, 13, 14, 14, 15, 16, 20, 21, 22];
const DAY_MS = 86_400_000;
const TAKER_FEE = 0.00045;
const MAKER_FEE = 0.00015;

/**
 * Builds a believable synthetic fill history in the same shape as real
 * exchange data, so the sample report exercises the exact analysis pipeline.
 * The behaviour is intentional: bigger size after losses, a weak spot in SOL
 * and HYPE, and a leaning towards longs.
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

  let orderId = 1_000;
  let tradeId = 1;
  let lastWasLoss: boolean = false;

  for (let i = 0; i < tradeCount; i++) {
    const market = pick();
    const isLong = random() < 0.68;
    const closeTime = closeTimes[i];
    const hour = new Date(closeTime).getUTCHours();

    const baseNotional = 4_000 + random() * 9_000;
    const notional: number = lastWasLoss ? baseNotional * (1.4 + random() * 0.5) : baseNotional;
    const price = market.price * (0.92 + random() * 0.16);
    const size = notional / price;

    const winChance = 0.56 + market.edge + (isLong ? 0.04 : -0.06) - (hour === 22 || hour === 21 ? 0.14 : 0);
    const win = random() < winChance;
    const move = win ? 0.006 + random() * 0.026 : -(0.005 + random() * 0.02);
    const pnl: number = notional * move * (win ? 1 : lastWasLoss ? 1.1 : 1);

    const openFee = notional * (random() < 0.15 ? MAKER_FEE : TAKER_FEE);
    const closeCrossed = random() < 0.85;
    const closeFee = notional * (closeCrossed ? TAKER_FEE : MAKER_FEE);
    const openTime = closeTime - (20 + random() * 600) * 60_000;
    const orderOpen = orderId++;
    const orderClose = orderId++;

    fills.push({
      id: String(tradeId++),
      coin: market.coin,
      price,
      size,
      isBuy: isLong,
      time: openTime,
      dir: isLong ? "Open Long" : "Open Short",
      closedPnl: 0,
      fee: openFee,
      orderId: orderOpen,
      crossed: true,
    });

    // Some exits fill in two slices, as large orders do on a real book.
    const slices = random() < 0.25 ? 2 : 1;
    for (let slice = 0; slice < slices; slice++) {
      fills.push({
        id: String(tradeId++),
        coin: market.coin,
        price: price * (1 + move * (isLong ? 1 : -1)),
        size: size / slices,
        isBuy: !isLong,
        time: closeTime + slice * 1_500,
        dir: isLong ? "Close Long" : "Close Short",
        closedPnl: pnl / slices,
        fee: closeFee / slices,
        orderId: orderClose,
        crossed: closeCrossed,
      });
    }

    lastWasLoss = pnl - closeFee < 0;
  }

  return fills;
}
