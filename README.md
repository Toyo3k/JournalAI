# JournalAI

JournalAI is a self-contained, browser-based AI trade journal demo.

## Run locally

Open `index.html` in any modern browser. No package installation, build step, API key, or server is required.

## Share on GitHub

Upload the complete `outputs` folder to a repository. The application source is `index.html`.

The app stores trades in the browser's local storage. CSV imports are processed locally in the browser and are not sent to a server.

## CSV columns

Required columns: `symbol` (or `ticker`) and `realized P&L` (or `pnl`).

Optional columns: `side`, `setup`, `emotion`, `rules`, and `date`.
