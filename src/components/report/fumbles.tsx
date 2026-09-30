import type { FumbleReport, TokenFumble } from "@/lib/analytics/fumbles";
import { formatMultiple, formatPercent, formatShortDate, formatTokenPrice, formatUsd, pluralise } from "@/lib/format";
import { loadDemoFumbles, loadFumbles } from "@/lib/fumbles";
import type { FumbleResult } from "@/lib/fumbles";
import type { DemoId } from "@/lib/report";
import styles from "./fumbles.module.css";
import report from "./report.module.css";

const SHOWN_FUMBLES = 4;
const SHOWN_EXITS = 3;

/** Streams in after the report: loads price histories for the wallets' biggest sales. */
export async function FumbleSection({ addresses, demo }: { addresses?: string[]; demo?: DemoId }) {
  let result: FumbleResult;
  try {
    result = demo ? loadDemoFumbles(demo) : await loadFumbles(addresses ?? []);
  } catch (error) {
    // Hindsight is a bonus, so a failure here never takes the report down with it.
    console.error("Fumble check failed", error);
    return <p className={`${report.card} ${styles.empty}`}>The fumble check isn&apos;t available right now. Reload in a minute to try again.</p>;
  }
  return <FumbleView result={result} />;
}

export function FumbleSkeleton() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className="sr-only">Checking what your sold tokens did next</span>
      <div className={report.skeleton} style={{ height: 150, borderRadius: 20 }} />
      <div className={styles.grid}>
        <div className={report.skeleton} style={{ height: 200, borderRadius: 20 }} />
        <div className={report.skeleton} style={{ height: 200, borderRadius: 20 }} />
      </div>
    </div>
  );
}

/** The one-line read on the whole check. */
function headline(summary: FumbleReport): string {
  const { leftAtPeak, vsToday, soldUsd } = summary;
  if (leftAtPeak < 0.01) return "Nothing you sold went higher afterwards. Every exit was at or near the top.";
  const share = soldUsd > 0 ? leftAtPeak / soldUsd : 0;
  const peakPart = share >= 1 ? `the tokens you sold more than doubled afterwards at some point` : `selling at each later peak would have paid ${formatPercent(share, 0)} more`;
  if (vsToday <= -0.01) return `In hindsight ${peakPart}, but most of that faded. Held until today, they'd be worth ${formatUsd(-vsToday)} less than you got.`;
  return `In hindsight ${peakPart}, and they're still worth ${formatUsd(vsToday)} more today than you sold them for.`;
}

export function FumbleView({ result }: { result: FumbleResult }) {
  const { report: summary, notes, sample } = result;

  if (!summary.checked) {
    return (
      <div className={styles.wrap}>
        <p className={`${report.card} ${styles.empty}`}>
          {notes.length
            ? notes[0]
            : summary.unchecked
              ? "We couldn't find price history for the tokens you sold, so there's nothing to compare yet."
              : "No token sales to check yet. Once you sell something, this shows what it did next."}
        </p>
        {notes.slice(1).map((note) => (
          <p className={report.notice} data-tone="info" key={note}>
            {note}
          </p>
        ))}
      </div>
    );
  }

  const fumbles = summary.fumbles.slice(0, SHOWN_FUMBLES);
  const exits = summary.goodExits.slice(0, SHOWN_EXITS);

  return (
    <div className={styles.wrap}>
      <div className={`${report.card} ${styles.summary}`}>
        <div className={styles.lead}>
          <span className={styles.kicker}>Left on the table</span>
          <strong className={`num ${styles.big}`}>{formatUsd(summary.leftAtPeak, { compact: true })}</strong>
          <p className={styles.headline}>{headline(summary)}</p>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>Held until today</dt>
            <dd className={`num ${summary.vsToday > 0 ? "neg" : "pos"}`}>
              {summary.vsToday > 0 ? `${formatUsd(summary.vsToday, { compact: true })} more` : `${formatUsd(-summary.vsToday, { compact: true })} less`}
            </dd>
          </div>
          <div>
            <dt>Sales checked</dt>
            <dd className="num">{formatUsd(summary.soldUsd, { compact: true })}</dd>
          </div>
          <div>
            <dt>Tokens</dt>
            <dd className="num">
              {summary.checked}
              {summary.unchecked ? <small> of {summary.checked + summary.unchecked}</small> : null}
            </dd>
          </div>
        </dl>
      </div>

      {fumbles.length ? (
        <div className={styles.grid}>
          {fumbles.map((token) => (
            <FumbleCard key={token.key} token={token} />
          ))}
        </div>
      ) : null}

      {exits.length ? (
        <div className={`${report.card} ${styles.exits}`}>
          <h3 className={styles.exitsTitle}>
            <span className={styles.exitNode} aria-hidden="true" />
            Good exits
          </h3>
          <ul>
            {exits.map((token) => (
              <li key={token.key}>
                <span className={styles.coin}>{token.coin}</span>
                <span className={styles.exitDetail}>
                  Sold around <span className="num">{formatTokenPrice(token.avgSellPrice)}</span>, now <span className="num">{formatTokenPrice(token.currentPrice)}</span>
                  <span className="num neg"> ({formatPercent(token.currentPrice / token.avgSellPrice - 1, 0)})</span>
                </span>
                <strong className="num pos">{formatUsd(-token.vsToday, { compact: true })} saved</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes.map((note) => (
        <p className={report.notice} data-tone="info" key={note}>
          {note}
        </p>
      ))}

      <p className={styles.footnote}>
        {sample
          ? "Sample price histories, generated for the sample wallet. "
          : `Your ${pluralise(summary.checked, "biggest sold token", "biggest sold tokens")}, priced from GeckoTerminal DEX data (hourly candles for the last 40 days, daily before that). `}
        Peaks only count from the moment you sold. This is hindsight, not advice: nobody sells every top.
      </p>
    </div>
  );
}

export function FumbleCard({ token }: { token: TokenFumble }) {
  const multiple = token.peakPrice / token.avgSellPrice;
  return (
    <article className={`${report.card} ${styles.card}`}>
      <header className={styles.cardHead}>
        <div>
          <h3 className={styles.coin}>{token.coin}</h3>
          <span className={styles.muted}>{token.sales === 1 ? "Sold once" : `Sold ${token.sales} times`}</span>
        </div>
        <div className={styles.cardFigure}>
          <strong className="num neg">+{formatUsd(token.leftAtPeak, { compact: true })}</strong>
          <span className={styles.muted}>left on the table</span>
        </div>
      </header>
      <Sparkline token={token} />
      <dl className={styles.prices}>
        <div>
          <dt>You sold</dt>
          <dd className="num">{formatTokenPrice(token.avgSellPrice)}</dd>
        </div>
        <div>
          <dt>Peak after, {formatShortDate(token.peakAt)}</dt>
          <dd className="num">
            {formatTokenPrice(token.peakPrice)} <span className={styles.multiple}>{formatMultiple(multiple)}</span>
          </dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd className={`num ${token.currentPrice >= token.avgSellPrice ? "neg" : "pos"}`}>{formatTokenPrice(token.currentPrice)}</dd>
        </div>
      </dl>
    </article>
  );
}

const W = 320;
const H = 88;
const PAD = 6;

/** Price after the first sale, with the sale price dashed across and the peak marked. */
function Sparkline({ token }: { token: TokenFumble }) {
  const { path } = token;
  if (path.length < 2) return null;
  const values = [...path.map((point) => point.price), token.avgSellPrice, token.peakPrice];
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Memecoins can move 100x, so wide ranges use a log scale to keep the sale line off the floor.
  const log = max / min > 8;
  const scale = (value: number) => (log ? Math.log(value) : value);
  const lo = scale(min);
  const span = scale(max) - lo || 1;
  const t0 = path[0].t;
  const tSpan = path.at(-1)!.t - t0 || 1;
  const x = (t: number) => PAD + ((t - t0) / tSpan) * (W - PAD * 2);
  const y = (value: number) => H - PAD - ((scale(value) - lo) / span) * (H - PAD * 2);
  const line = path.map((point, i) => `${i ? "L" : "M"}${x(point.t).toFixed(1)} ${y(point.price).toFixed(1)}`).join(" ");
  const area = `${line} L${x(path.at(-1)!.t).toFixed(1)} ${H} L${x(t0).toFixed(1)} ${H} Z`;
  const sellY = y(token.avgSellPrice);
  const peakX = x(Math.min(Math.max(token.peakAt, t0), path.at(-1)!.t));
  const peakY = y(token.peakPrice);
  const gradient = `fumble-${token.key.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className={styles.sparkWrap}>
      <svg
        className={styles.spark}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${token.coin} after you sold: from ${formatTokenPrice(token.avgSellPrice)} to a peak of ${formatTokenPrice(token.peakPrice)}, now ${formatTokenPrice(token.currentPrice)}.`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--caution)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--caution)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradient})`} />
        <path d={line} fill="none" stroke="var(--caution)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <line x1={PAD} x2={W - PAD} y1={sellY} y2={sellY} stroke="var(--accent-strong)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <line x1={peakX} x2={peakX} y1={peakY} y2={sellY} stroke="var(--caution)" strokeOpacity="0.5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* HTML, not SVG, so the stretched chart doesn't squash the dot. */}
      <span className={styles.peak} style={{ left: `${(peakX / W) * 100}%`, top: `${(peakY / H) * 100}%` }} aria-hidden="true" />
      <span className={styles.sellTag} style={{ top: `${(sellY / H) * 100}%` }} aria-hidden="true">
        sold
      </span>
    </div>
  );
}
