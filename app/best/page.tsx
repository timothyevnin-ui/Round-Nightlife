import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { CityRank } from "@/components/CityRank";
import { TabBar } from "@/components/TabBar";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { getVenues } from "@/lib/db";
import { rankVenues, ratersOf } from "@/lib/rank";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The best bars in New York, ranked by New York",
  description: "Every bar on ROUND, ranked: ROUND's score and the people's number, from the ladders of New Yorkers who've actually been.",
};

/** The city's ladder (V33): every bar, ranked, with a way into each neighborhood. */
export default async function BestPage() {
  const venues = await getVenues();
  const rows = rankVenues(venues, 50);
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <header className="flex items-center justify-between pt-4 pb-1">
        <Wordmark />
        <Link href="/" className="pressable eyebrow" style={{ color: "var(--ink-45)" }}>
          Home
        </Link>
      </header>
      <section className="pt-6">
        <p className="eyebrow" style={{ color: "var(--pine-bright)" }}>
          New York
        </p>
        <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 0.98, letterSpacing: "-0.025em" }}>
          The best bars,
          <br />
          ranked by the city.
        </h1>
        <p className="mt-3 text-[14px] leading-snug" style={{ color: "var(--ink-55)" }}>
          ROUND&apos;s number and the people&apos;s number, side by side. The people&apos;s comes from the ladders of everyone who&apos;s been, once three have.
        </p>
      </section>
      <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5" data-hood-links>
        {NEIGHBORHOODS.map((n) => (
          <Link key={n.id} href={`/best/${n.id}`} className="pressable inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[12.5px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}>
            {n.name}
          </Link>
        ))}
      </div>
      <CityRank rows={rows} raters={ratersOf(venues)} compact={false} />
      <TabBar />
    </main>
  );
}
