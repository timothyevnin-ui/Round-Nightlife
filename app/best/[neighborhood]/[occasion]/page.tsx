import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { Photo } from "@/components/Photo";
import { NEIGHBORHOODS, isNeighborhoodId, neighborhoodName } from "@/lib/neighborhoods";
import { OCCASIONS, OCCASION_MAP } from "@/lib/occasions";

/** Server-rendered, indexable pages: the 5pm.nyc-style surface, powered by the same engine. */

export function generateStaticParams() {
  return NEIGHBORHOODS.flatMap((n) => OCCASIONS.map((o) => ({ neighborhood: n.id, occasion: o.id })));
}

export async function generateMetadata({ params }: PageProps<"/best/[neighborhood]/[occasion]">): Promise<Metadata> {
  const { neighborhood, occasion } = await params;
  const o = OCCASION_MAP[occasion];
  if (!isNeighborhoodId(neighborhood) || !o) return { title: "ROUND" };
  const hood = neighborhoodName(neighborhood);
  return { title: o.title(hood), description: o.blurb(hood), openGraph: { title: o.title(hood), description: o.blurb(hood) } };
}

export default async function BestPage({ params }: PageProps<"/best/[neighborhood]/[occasion]">) {
  const { neighborhood, occasion } = await params;
  const o = OCCASION_MAP[occasion];
  if (!isNeighborhoodId(neighborhood) || !o) notFound();
  const hood = neighborhoodName(neighborhood);
  const venues = o.pick(neighborhood);
  const others = OCCASIONS.filter((x) => x.id !== o.id);
  const hoods = NEIGHBORHOODS.filter((n) => n.id !== neighborhood);

  return (
    <main className="screen mx-auto w-full max-w-md pb-16">
      <header className="flex items-center justify-between pt-5 pb-2">
        <Wordmark />
        <Link href="/" className="pressable btn-ghost flex h-9 items-center px-3.5 text-[12.5px]">
          Ask for tonight
        </Link>
      </header>

      <section className="pt-6 pb-6">
        <p className="eyebrow">{hood}</p>
        <h1 className="serif mt-2" style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {o.title(hood)}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.5]" style={{ color: "var(--chalk-70)" }}>
          {o.blurb(hood)}
        </p>
      </section>

      <ol className="flex flex-col gap-3">
        {venues.map((v, i) => (
          <li key={v.slug}>
            <Link href={`/v/${v.slug}`} className="pressable card flex items-center gap-4 p-3">
              <Photo venue={v} rounded="rounded-[16px]" className="h-[76px] w-[76px] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">
                  {i + 1} · {neighborhoodName(v.neighborhood)}
                </p>
                <h2 className="serif mt-0.5 truncate" style={{ fontSize: 23, lineHeight: 1.1 }}>
                  {v.name}
                </h2>
                <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
                  {v.take}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {venues.length === 0 && (
          <li className="card p-5 text-[14.5px]" style={{ color: "var(--chalk-70)" }}>
            ROUND is still walking this one. Try a neighborhood next door.
          </li>
        )}
      </ol>

      <section className="mt-10 rounded-[28px] p-5" style={{ background: "linear-gradient(160deg, #1a2fb8, #2b4dff)" }}>
        <p className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
          Lists are for reading. ROUND is for tonight.
        </p>
        <p className="mt-2 text-[14px]" style={{ color: "rgba(242,240,234,0.8)" }}>
          Tell it the neighborhood, the vibe, how many of you, and when. Three places, ten seconds.
        </p>
        <Link href="/" className="pressable btn-primary mt-4 flex h-12 items-center justify-center text-[15px]">
          Where should we go?
        </Link>
      </section>

      <nav className="mt-10">
        <p className="eyebrow">More in {hood}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {others.map((x) => (
            <Link key={x.id} href={`/best/${neighborhood}/${x.id}`} className="pressable btn-ghost flex h-9 items-center px-3.5 text-[12.5px]">
              {x.title(hood).replace(` in ${hood}`, "").replace(` bars`, " bars")}
            </Link>
          ))}
        </div>
        <p className="eyebrow mt-6">{o.title("").replace(" in ", "").trim() || "Same idea"}, elsewhere</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {hoods.map((n) => (
            <Link key={n.id} href={`/best/${n.id}/${o.id}`} className="pressable btn-ghost flex h-9 items-center px-3.5 text-[12.5px]">
              {n.name}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
