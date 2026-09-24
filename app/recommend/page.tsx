import type { Metadata } from "next";
import { dbConfig } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { countApproved } from "@/lib/suggestions";
import { RecommendView, type Offer } from "./RecommendView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recommend a place",
  description: "Know a bar or restaurant ROUND should know about? Two minutes. We check every one.",
};

/** The offer as it stands right now: on or off, the cap, and how many of the cap are already spoken for. */
export default async function RecommendPage() {
  const { writable } = dbConfig();
  const { bounty } = await getSettings();
  const approved = writable ? await countApproved().catch(() => 0) : 0;
  const offer: Offer = { open: bounty.open && approved < bounty.cap, cap: bounty.cap, amount: bounty.amount, approved };
  return <RecommendView offer={offer} />;
}
