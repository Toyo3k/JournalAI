import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  // Share card image URLs are resolved against this, so it must be the public origin in production.
  metadataBase: new URL(siteUrl),
  twitter: { card: "summary_large_image" },
  title: { default: "JournalAI. Trading insights from any wallet", template: "%s | JournalAI" },
  description:
    "Paste a Robinhood Chain wallet address and get a clear, data-backed review of its trading history: win rate, gas costs, drawdown, and the habits costing or making money.",
};

export const viewport: Viewport = {
  themeColor: "#08090c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
