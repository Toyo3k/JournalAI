import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JournalAI — AI Trade Journal",
  description: "A local-first trade journal that turns executions into evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
