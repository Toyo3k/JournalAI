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
- History is capped at three pages of 10,000 rows per data type, and the report says when it is cut off.

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
    demo/                 Report for generated sample data
  components/
    layout/               Header and footer
    home/                 Address form and landing sections
    journal/              Trade form, CSV import, behaviour analysis (client side)
    report/               Stat cards, charts, tables, insights
    ui/                   Small shared primitives
  lib/
    robinhood/            Etherscan client, ETH prices, swap reconstruction
    analytics/            Fills -> trades -> metrics -> insights
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
