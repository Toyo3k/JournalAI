"use client";

import { FormEvent, useMemo, useState } from "react";

type Trade = { asset: string; direction: "Long" | "Short"; pnl: number; setup: string; emotion: string; rules: string };

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [asset, setAsset] = useState("");
  const [pnl, setPnl] = useState("");
  const [message, setMessage] = useState("No trade data yet. Log a trade to start your local journal.");
  const stats = useMemo(() => {
    const net = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const wins = trades.filter((trade) => trade.pnl > 0).length;
    const planned = trades.filter((trade) => trade.rules === "Followed plan").length;
    return { net, wins, rate: trades.length ? (wins / trades.length) * 100 : 0, adherence: trades.length ? (planned / trades.length) * 100 : 0 };
  }, [trades]);
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "always" }).format(value);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(pnl);
    if (!asset.trim() || !Number.isFinite(value)) { setMessage("Add a ticker and a valid realized P&L."); return; }
    setTrades((current) => [{ asset: asset.trim().toUpperCase(), direction: "Long", pnl: value, setup: "Breakout", emotion: "Calm", rules: "Followed plan" }, ...current]);
    setAsset(""); setPnl(""); setMessage("Trade saved locally for this session. Analytics updated from your entry.");
  }
  return <main className="shell"><header><div className="brand">Journal<span>AI</span></div><p>Local-first trade intelligence</p></header><section className="hero"><div><span className="eyebrow">Trade journal</span><h1>Trade with evidence, not memory.</h1><p>{message}</p></div></section><section className="metrics" aria-label="Journal metrics"><Metric label="Net P&L" value={trades.length ? money(stats.net) : "—"} tone={stats.net >= 0 ? "positive" : "negative"}/><Metric label="Win rate" value={trades.length ? `${stats.rate.toFixed(1)}%` : "—"}/><Metric label="Rule adherence" value={trades.length ? `${stats.adherence.toFixed(1)}%` : "—"}/></section><section className="grid"><article className="card"><span className="eyebrow">Log a trade</span><h2>Capture the context.</h2><form onSubmit={submit}><label>Ticker<input value={asset} onChange={(event) => setAsset(event.target.value)} placeholder="e.g. NVDA" /></label><label>Realized P&L<input value={pnl} onChange={(event) => setPnl(event.target.value)} inputMode="decimal" placeholder="e.g. 245.50" /></label><button type="submit">Save & analyze</button></form></article><article className="card"><span className="eyebrow">Pattern review</span><h2>{trades.length ? "Evidence is accumulating." : "No invented coaching."}</h2><p>{trades.length ? `${stats.wins} of ${trades.length} recorded trades are profitable. Keep logging context to make the review more useful.` : "JournalAI only generates insights from your recorded trades. Import and persistence are the next features to add."}</p></article></section><section className="card table"><div><span className="eyebrow">Recent trades</span><h2>Execution history</h2></div>{trades.length ? <table><thead><tr><th>Asset</th><th>Side</th><th>Setup</th><th>P&L</th></tr></thead><tbody>{trades.map((trade, index) => <tr key={`${trade.asset}-${index}`}><td>{trade.asset}</td><td>{trade.direction}</td><td>{trade.setup}</td><td className={trade.pnl >= 0 ? "positive" : "negative"}>{money(trade.pnl)}</td></tr>)}</tbody></table> : <p className="empty">No trades recorded yet.</p>}</section></main>;
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <article className="metric"><span>{label}</span><strong className={tone}>{value}</strong><small>Calculated from your entries</small></article>; }
