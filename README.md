# JournalAI

Paste a wallet address and get a data-backed review of its trading history: net P&L after fees, win rate, profit
factor, drawdown, and plain-language insights about the habits that make or cost money.

Data comes from the public [Hyperliquid info API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
(fills, fees, realized P&L). It is read-only and needs no API key, wallet connection or signature.

## Getting started

```bash
pnpm install
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

## Structure

```
src/
  app/                    Routes only
    page.tsx              Landing page with the address form
    wallet/[address]/     Report for a wallet (page, loading, error)
    demo/                 Report for generated sample data
  components/
    layout/               Header and footer
    home/                 Address form and landing sections
    report/               Stat cards, charts, tables, insights
    ui/                   Small shared primitives
  lib/
    hyperliquid/          API client (paging, error handling)
    analytics/            Fills -> trades -> metrics -> insights
    demo/                 Deterministic sample data generator
    report.ts             Loads a wallet or demo into a WalletReport
    format.ts, address.ts Helpers
```

## How the analysis works

1. **Fetch** every available fill for the address (up to the exchange's 10,000 most recent).
2. **Group** closing fills from the same order into one trade, so a sliced order counts once.
3. **Measure** P&L (net of fees), win rate, profit factor, expectancy, drawdown, streaks, and breakdowns by market,
   side, hour and weekday.
4. **Explain** with rule-based insights. Each one states the figures behind it, and nothing is shown without enough
   data to support it.

Reports are cached for five minutes per address. Hours and weekdays are in UTC. Realized P&L only: unrealized gains
on open positions are not included.

## Scope

Only Hyperliquid perpetuals are supported today. Adding a venue means implementing a client in `src/lib/hyperliquid/`
style that returns the normalized `Fill` type; the analytics layer is exchange-agnostic.
