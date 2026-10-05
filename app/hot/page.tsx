import type { Metadata } from "next";
import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { HotShelf } from "@/components/HotShelf";
import { Wordmark } from "@/components/Wordmark";
import { getVenues } from "@/lib/db";
import { hotVenues } from "@/lib/hot";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "What's hot right now",
  description: "Where ROUND went this week: the bars worth a night, and why.",
};

export default async function HotPage() {
  const hot = hotVenues(await getVenues());
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <header className="flex items-center justify-between pt-4 pb-1">
        <Wordmark />
        <Link href="/" className="pressable eyebrow" style={{ color: "var(--ink-35)" }}>
          Home
        </Link>
      </header>
      <HotShelf venues={hot} compact />
      {hot.length === 0 && (
        <p className="mt-10 text-[15px]" style={{ color: "var(--ink-55)" }}>
          Nothing on the shelf yet. Flip a place on in the back office and write its story.
        </p>
      )}
      <TabBar />
    </main>
  );
}
