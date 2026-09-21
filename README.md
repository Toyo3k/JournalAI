# JournalAI

Paste a Robinhood Chain wallet address and get a data-backed review of its trading history: net P&L after gas, win
rate, profit factor, drawdown, and plain-language insights about the habits that make or cost money. There is also a
private trade journal that keeps everything in your browser.

Everything is read-only. There is no wallet connection and nothing to sign.

## Getting started

```bash
pnpm install
```

Add your Etherscan API key to `.env.local` (free at https://etherscan.io/apis, Robinscan runs on it):

```
ETHERSCAN_API_KEY=your_key_here
```

```bash
pnpm dev
```

Open http://localhost:3000. Use **Sample report** to explore without an address.

## Holding time, risk and stock context

Wallet reports add three sections beyond the headline numbers:

- **Holding time.** Average and median hold, winners against losers, and results by holding period (under 1h up to
  over 7d). It flags holding losers longer than winners (the disposition effect) and quick flips that lose money. Each
  sale is dated by the oldest shares it sold (first in, first out), so a position built over several buys is timed from
  its earliest purchase. Not available for the journal, which does not record open times.
- **Risk.** A Sharpe-like and Sortino-like ratio, the Kelly fraction, recovery factor, longest drawdown and whether the
  wallet is still under water, 95% value at risk, and how much worse the worst loss was than a typical one. There are
  no account balances on chain, so the ratios are built from daily P&L and are best read as consistency scores. They
  need at least two weeks of history and eight active days, and are withheld otherwise. A **What if** list shows what
  skipping the worst hour, the worst token, or oversized losses would have changed. It is hindsight, not a forecast.
- **Stock tokens.** Robinhood's official public list (`api.robinhood.com/rhj/assets`, cached for an hour) is used to
  identify stock tokens **by contract address**, not by symbol, so a lookalike token named TSLA is not counted. The
  section splits P&L between stock tokens and everything else, groups stock trades by the US market session they were
  closed in (regular, pre-market, after hours, overnight, or market closed on weekends and holidays, all in New York
  time), and lists the stocks traded with company names. If the list cannot be reached the section is simply omitted.

Limits worth knowing: the market holiday calendar in `src/lib/analytics/sessions.ts` covers 2025 to 2027 and needs
extending after that (outside it only weekends count as closed), and Robinhood's corporate actions feed is not used
because it only covers about two months.

## Sharing and comparing

- **Share cards.** Every wallet report has a generated 1200x630 card (net P&L, win rate, profit factor, equity curve)
  used as the link preview when the page is shared. **Share card** opens a preview of the exact image first, with a
  download button inside it, and there is a **Copy link** button too. The image is only generated once the preview is
  opened. The card lives at
  `/wallet/[address]/opengraph-image`, and falls back to a branded card if the wallet cannot be loaded. Set
  `NEXT_PUBLIC_SITE_URL` in production so preview image URLs point at your public origin.
- **Compare wallets.** `/compare?a=0x...&b=0x...` puts two wallets side by side: a metric table with the better value
  marked, overlaid equity curves on a shared timeline, head-to-head sentences, shared markets, and each wallet's top
  insights. Raw P&L favours whichever wallet trades more capital, so the table also scores **net P&L per dollar
  traded**, and the verdict calls out when the wallet that made more is not the one that traded better. The
  identifiers `demo` and `demo-2` compare the two generated sample wallets without an API key.

| Script           | Purpose                    |
| ---------------- | -------------------------- |
| `pnpm dev`       | Start the dev server       |
| `pnpm build`     | Production build           |
| `pnpm start`     | Serve the production build |
| `pnpm lint`      | ESLint                     |
| `pnpm typecheck` | TypeScript, no emit        |
| `pnpm test`      | Unit tests (Vitest)        |

`COINGECKO_API_KEY` is optional and raises the rate limit on the ETH/USD prices used to value swaps. See
`.env.example`.

## Wallet reports

`/wallet/[address]` reads a wallet's transfers on Robinhood Chain (chain 4663) through Etherscan's V2 API and rebuilds
its swaps into trades. The reports are cached for five minutes per address.

Etherscan returns transfers, not trades, so swaps are inferred: a transaction that moves one token against a
stablecoin or ETH is a buy or sell. Stablecoins count as $1, ETH is valued at its daily CoinGecko price, and realized
P&L uses average cost. Gas is included as a fee. Things to know:

- Swaps between two non-stable tokens cannot be priced and are left out.
- Sales with no earlier purchase in the visible history have no cost basis and are left out.
- Tokens are matched by symbol, so a counterfeit token named like a stablecoin would be valued as one.
- Only realized P&L is shown. Unrealized gains on open positions are not included.
- History is capped at 3,000 rows per data type, oldest first. Etherscan rows can be very large (a transaction row
  carries its full calldata), so an uncapped load of a busy wallet takes a minute. When any dataset hits the cap, every
  dataset is cut to the same moment so swaps stay whole, and the report says so. Normal wallets are complete.
- Reports are cached in memory by address for five minutes. Next's own fetch cache is not used for Etherscan, because
  it is keyed by URL and the URL contains your API key.

## Private journal

`/journal` is a local-first trade journal that needs no wallet or account. Everything is stored in your browser and
never uploaded.

- **Log trades** with realized P&L, optional size, setup, emotion at entry, rule adherence, notes and close time.
- **Import a CSV.** Only a ticker and a realized P&L column are required. Side, size, setup, emotion, rules, notes
  and date are picked up when present, under common header names (for example `Net P&L`, `Strategy`, `Closed At`).
- **Behaviour analysis** compares results by emotion, setup and plan adherence, and turns the differences into
  insights such as "Breaking the plan costs you".
- **Report periods** for the last 7 days, 30 days or all time, plus **Print report** for a clean light-themed copy.

Entries feed the same analytics engine as wallet reports, so the equity curve, drawdown, streaks and time-of-day
charts work on them too.

## Structure

```
src/
  app/                    Routes only
    page.tsx              Landing page with the address form
    wallet/[address]/     Wallet report (page, loading, error)
    journal/              Private local journal
    compare/              Side by side comparison of two wallets
    demo/                 Report for generated sample data
  components/
    layout/               Header and footer
    home/                 Address form and landing sections
    journal/              Trade form, CSV import, behaviour analysis (client side)
    report/               Stat cards, charts, tables, insights
    compare/              Comparison form, overlaid chart, metric table
    share/                Share card image and share buttons
    ui/                   Small shared primitives
  lib/
    robinhood/            Etherscan client, ETH prices, swap reconstruction, stock token registry
    analytics/            Fills -> trades -> metrics -> insights, plus holding, risk, stock context and comparison
    journal/              Entry types, storage, CSV parser, behaviour patterns
    demo/                 Deterministic sample data generator
    report.ts             Loads a wallet or the demo into a WalletReport
    format.ts, address.ts Helpers
```

## How the analysis works

1. **Fetch** the wallet's transactions, internal transactions and token transfers from Etherscan.
2. **Reconstruct** swaps and realize P&L against average cost (`src/lib/robinhood/swaps.ts`).
3. **Group** closing fills from the same transaction into one trade.
4. **Measure** P&L, win rate, profit factor, expectancy, drawdown, streaks, and breakdowns by token, hour and weekday.
5. **Explain** with rule-based insights. Each one states the figures behind it, and nothing is shown without enough
   data to support it.

Hours and weekdays are in UTC.
