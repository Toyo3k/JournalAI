# NeuroX

Paste a Robinhood Chain or Solana wallet address and get a data-backed review of its trading history: net P&L after gas, win
rate, profit factor, drawdown, and plain-language insights about the habits that make or cost money. There is also a
private trade journal that keeps everything in your browser.

Everything is read-only. There is no wallet connection and nothing to sign.

## Getting started

```bash
pnpm install
```

Add your API keys to `.env.local`. Etherscan (free at https://etherscan.io/apis, Robinscan runs on it) is for Robinhood
Chain wallets, and Helius (free at https://dashboard.helius.dev) is for Solana wallets. Either one alone is enough for
its own chain.

```
ETHERSCAN_API_KEY=your_key_here
HELIUS_API_KEY=your_key_here
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

`COINGECKO_API_KEY` is optional but recommended. It raises the rate limit on the ETH/USD and SOL/USD prices used to
value swaps, and lets the fumble check look at 12 tokens instead of 4 (see below). A free demo key is enough. See
`.env.example`.

## Multi-wallet reports

Paste several addresses into the form (separated by commas, spaces or new lines) and they become chips, each labelled
with the chain detected from its format. One address opens `/wallet/[address]`. Two or more open
`/portfolio?w=...&w=...`, a combined report across up to 5 wallets on any mix of Robinhood Chain and Solana.

- Each wallet loads through the same cache as its own report, and their trades are merged into one report with a
  per-wallet breakdown table. Order ids are prefixed per wallet, so trades from different wallets never merge.
- A wallet that fails (a missing key, a rate limit) is left out with the reason shown. The page only errors when no
  wallet loads.
- Notes every wallet shares are shown once. Other notes are prefixed with the wallet they belong to.

## Fumble check

Every wallet, multi-wallet and sample report has a **Fumbles** section. For each token you sold, it compares the price
you got with the highest price the token reached after that sale ("left on the table") and with today's price.
Tokens now worth less than you sold them for are listed as **good exits**.

- Prices come from GeckoTerminal's on-chain DEX data (`src/lib/prices/geckoterminal.ts`), which covers Robinhood
  Chain and Solana pools, memecoins included. Each token uses its most liquid pool, with hourly candles when the first
  sale is within 40 days and daily candles before that.
- Only candles that start at or after a sale count toward its peak, so a high earlier in the same hour is never held
  against you. The maths is in `src/lib/analytics/fumbles.ts`.
- The biggest sold tokens by USD are checked: 12 with `COINGECKO_API_KEY` (CoinGecko's keyed copy of the same API, 30
  calls a minute), or 4 without (GeckoTerminal's public API allows only about 5 calls a minute in practice). Every
  call goes through one shared rate limiter. After a 429 it backs off for 30 seconds instead of retrying, because
  refused calls count against the quota too.
- The section streams in after the rest of the report, so it never slows the page. If the price service is busy, it
  shows what it could check and asks you to reload in a minute. Candles are cached (15 minutes hourly, 6 hours daily).
- The sample report uses generated price histories and says so.

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

## Solana wallets

The same `/wallet/[address]` route takes Solana addresses. The chain is told apart by format: `0x` followed by 40 hex
characters is Robinhood Chain, and 32 to 44 base58 characters is Solana. Solana addresses are case-sensitive, so they
are not lowercased. `/compare` accepts either, including one of each.

History comes from Helius' enhanced transactions API (`src/lib/solana`), and swaps are rebuilt by the same code as
Robinhood Chain. Differences worth knowing:

- Trades come from each transaction's **balance changes**, not its transfer list. Solana swaps usually wrap SOL into a
  temporary account and unwrap it again, which lists several transfers for one real change. Wrapped SOL counts as SOL.
- Stablecoins (USDC, USDT, PYUSD) are matched **by mint address**, so a counterfeit token named USDC is not valued at
  $1. SOL is valued at its daily CoinGecko price, and the transaction fee (priority fee included) is counted as gas.
- Rent for a new token account (about 0.002 SOL) counts as part of the purchase, and rent returned when an account is
  closed counts toward the sale. Tips such as Jito tips count as part of the swap.
- Token symbols come from Helius' DAS API and are labels only. If they cannot be loaded, a shortened mint is shown.
- History is capped at 2,000 transactions, **newest first**, so a very busy wallet shows its recent trading. Sales of
  tokens bought before that window have no cost basis and are left out, and the report says so.
- There is no stock token section, since Robinhood stock tokens are not on Solana.

## Private journal

`/journal` is a local-first trade journal that needs no wallet or account. Everything is stored in your browser and
never uploaded. It is built for memecoins, so a trade is a buy then a sell: there is no long or short side.

- **Log trades** with realized P&L, optional size, setup, emotion at entry, rule adherence, notes and close time.
- **Import a CSV.** Only a ticker and a realized P&L column are required. Size, setup, emotion, rules, notes and date
  are picked up when present, under common header names (for example `Net P&L`, `Strategy`, `Closed At`). A side or
  direction column is ignored. Entries saved while the journal still had long/short load as before, without it.
- **Behaviour analysis** compares results by emotion, setup and plan adherence, and turns the differences into
  insights such as "Breaking the plan costs you".
- **Report periods** for the last 7 days, 30 days or all time, plus **Print report** for a clean light-themed copy.

Entries feed the same analytics engine as wallet reports, so the equity curve, drawdown, streaks and time-of-day
charts work on them too.

## Structure

```
src/
  app/                    Routes only
    page.tsx              Landing page with the multi-wallet form and a live sample preview
    wallet/[address]/     Wallet report (page, loading, error)
    portfolio/            Combined report across several wallets
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
    robinhood/            Etherscan client, USD prices, swap reconstruction, stock token registry
    solana/               Helius client and Solana balance changes
    prices/               GeckoTerminal token prices and candles for the fumble check
    analytics/            Fills -> trades -> metrics -> insights, plus holding, risk, stock context and comparison
    journal/              Entry types, storage, CSV parser, behaviour patterns
    demo/                 Deterministic sample data generator
    report.ts             Loads a wallet, several wallets or the demo into a WalletReport
    fumbles.ts            Loads the fumble check for a set of wallets, or for the demo
    format.ts, address.ts Helpers
```

## How the analysis works

1. **Fetch** the wallet's transactions, internal transactions and token transfers from Etherscan, or its transactions
   from Helius for Solana.
2. **Reconstruct** swaps and realize P&L against average cost (`src/lib/robinhood/swaps.ts`).
3. **Group** closing fills from the same transaction into one trade.
4. **Measure** P&L, win rate, profit factor, expectancy, drawdown, streaks, and breakdowns by token, hour and weekday.
5. **Explain** with rule-based insights. Each one states the figures behind it, and nothing is shown without enough
   data to support it.

Hours and weekdays are in UTC.
