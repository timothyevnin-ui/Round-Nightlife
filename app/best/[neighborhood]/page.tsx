import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { CityRank } from "@/components/CityRank";
import { TabBar } from "@/components/TabBar";
import { NEIGHBORHOODS, isNeighborhoodId, neighborhoodName } from "@/lib/neighborhoods";
import { OCCASIONS } from "@/lib/occasions";
import { getVenues } from "@/lib/db";
import { rankVenues, ratersOf } from "@/lib/rank";

export const revalidate = 60;

const SHORT: Record<string, string> = { "big-group": "A big group", date: "A date", "can-actually-talk": "Can actually talk", lively: "Lively" };

export function generateStaticParams() {
  return NEIGHBORHOODS.map((n) => ({ neighborhood: n.id }));
}

export async function generateMetadata({ params }: PageProps<"/best/[neighborhood]">): Promise<Metadata> {
  const { neighborhood } = await params;
  if (!isNeighborhoodId(neighborhood)) return { title: "ROUND" };
  const hood = neighborhoodName(neighborhood);
  const title = `The best bars in ${hood}, ranked`;
  const description = `Every bar ROUND covers in ${hood}, ranked by ROUND's score and by the New Yorkers who've been.`;
  return { title, description, openGraph: { title, description } };
}

/** One neighborhood's ladder (V33): the page people send each other. */
export default async function BestHoodPage({ params }: PageProps<"/best/[neighborhood]">) {
  const { neighborhood } = await params;
  if (!isNeighborhoodId(neighborhood)) notFound();
  const hood = neighborhoodName(neighborhood);
  const all = await getVenues();
  const here = all.filter((v) => v.neighborhood === neighborhood || v.locations?.some((l) => l.neighborhood === neighborhood));
  const rows = rankVenues(here, 30);
  const others = NEIGHBORHOODS.filter((n) => n.id !== neighborhood);
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-best-hood={neighborhood}>
      <header className="flex items-center justify-between pt-4 pb-1">
        <Wordmark />
        <Link href="/best" className="pressable eyebrow" style={{ color: "var(--ink-45)" }}>
          All of New York
        </Link>
      </header>
      <section className="pt-6">
        <p className="eyebrow" style={{ color: "var(--pine-bright)" }}>
          {hood}
        </p>
        <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 0.98, letterSpacing: "-0.025em" }}>
          The best bars
          <br />
          in {hood}.
        </h1>
        <p className="mt-3 text-[14px] leading-snug" style={{ color: "var(--ink-55)" }}>
          {rows.length ? `${rows.length} ${rows.length === 1 ? "bar" : "bars"}, ranked by ROUND and by the people who've been.` : "Nothing ranked here yet."}
        </p>
      </section>
      <CityRank rows={rows} raters={ratersOf(here)} title={`Ranked · ${hood}`} compact={false} />
      <section className="pt-9">
        <p className="eyebrow">By the night</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <Link key={o.id} href={`/best/${neighborhood}/${o.id}`} className="pressable inline-flex h-9 items-center rounded-full border px-3.5 text-[12.5px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}>
              {SHORT[o.id] ?? o.id}
            </Link>
          ))}
        </div>
      </section>
      <section className="pt-8">
        <p className="eyebrow">Elsewhere</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {others.map((n) => (
            <Link key={n.id} href={`/best/${n.id}`} className="pressable inline-flex h-9 items-center rounded-full border px-3.5 text-[12.5px] font-medium" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }}>
              {n.name}
            </Link>
          ))}
        </div>
      </section>
      <TabBar />
    </main>
  );
}
