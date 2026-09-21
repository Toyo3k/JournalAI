import type { Metadata } from "next";
import { JournalApp } from "@/components/journal/journal-app";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage() {
  return <JournalApp />;
}
