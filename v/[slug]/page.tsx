import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Photo } from "@/components/Photo";
import { TrackView } from "@/components/TrackView";
import { FriendsChip } from "@/components/VenueCard";
import { VenueActions } from "./VenueActions";
import { BackButton } from "@/components/BackButton";
import { bestFor, describeWindows, priceLabel } from "@/lib/describe";
import { neighborhoodName } from "@/lib/neighborhoods";
import { encodePlan } from "@/lib/plan";
import { SEED_VENUES } from "@/lib/venues";
import { getVenue } from "@/lib/db";
import { strongAttrLabels } from "@/lib/engine";
import { storyParagraphs } from "@/lib/hot";

export const revalidate = 60;
export const dynamicParams = true;

export function generateStaticParams() {
  return SEED_VENUES.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVenue(slug);
  if (!v) return { title: "ROUND" };
  const title = `${v.name} · ${neighborhoodName(v.neighborhood)}`;
  return {
    title: v.name,
    description: v.take,
    openGraph: { title, description: v.take, type: "article" },
    twitter: { card: "summary_large_image", title, description: v.take },
  };
}

export default async function VenuePage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const v = await getVenue(slug);
  if (!v) notFound();
  const shareCode = encodePlan({ m: "night", n: v.neighborhood, t: 21, s: [{ bar: v.slug }] });
  const facts = [
    { k: "Best for", v: bestFor(v).join(" · ") || "Tonight" },
    { k: "Best time", v: describeWindows(v.bestWindows) },
    { k: "Price", v: priceLabel(v.price) },
    { k: "Room", v: { tiny: "Tiny", small: "Small", medium: "Medium", large: "Big" }[v.capacity] },
  ];

  return (
    <main className="mx-auto w-full max-w-md pb-14">
      <TrackView slug={v.slug} />
      <div className="relative">
        <Photo venue={v} rounded="rounded-none" className="aspect-[4/5] w-full" credit>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
            <BackButton />
          </div>
          <div className="absolute bottom-5 left-5">
            <FriendsChip count={v.friendsBeen} />
          </div>
        </Photo>
      </div>

      <div className="screen" style={{ minHeight: 0, paddingTop: 22 }}>
        <p className="eyebrow">
          {neighborhoodName(v.neighborhood)} · {v.kind === "restaurant" ? "Restaurant" : "Bar"}
          {v.hot && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>
              HOT RIGHT NOW
            </span>
          )}
        </p>
        <h1 className="serif mt-2" style={{ fontSize: 38, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          {v.name}
        </h1>
        <p className="mt-3 text-[13px] font-medium tracking-wide" style={{ color: "var(--chalk-55)" }}>
          {(v.tags.length ? v.tags : strongAttrLabels(v)).join(" · ")}
        </p>

        <VenueActions venue={v} shareUrl={`/p/${shareCode}`} />

        <section className="mt-9">
          <p className="eyebrow">ROUND&apos;s Take</p>
          <p className="serif mt-2" style={{ fontSize: 24, lineHeight: 1.25 }}>
            {v.take}
          </p>
        </section>

        {v.theCatch && (
          <section className="mt-7">
            <p className="eyebrow">The catch</p>
            <p className="mt-2 text-[15.5px] leading-[1.5]" style={{ color: "var(--chalk-70)" }}>
              {v.theCatch}
            </p>
          </section>
        )}

        {storyParagraphs(v.story).length > 0 && (
          <section id="story" className="story mt-8 scroll-mt-6 rounded-[24px] p-5" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
            <p className="eyebrow" style={{ color: "var(--tomato)" }}>
              The story
            </p>
            <div className="mt-3 text-[16px] leading-[1.6]" style={{ color: "var(--ink-70)" }}>
              {storyParagraphs(v.story).map((para, i) => (
                <p key={i} className={i === 0 ? "serif" : ""} style={i === 0 ? { fontSize: 21, lineHeight: 1.3, color: "var(--ink)" } : undefined}>
                  {para}
                </p>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          {facts.map((f) => (
            <div key={f.k}>
              <p className="eyebrow">{f.k}</p>
              <p className="mt-1.5 text-[14.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
                {f.v}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-7 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          <p className="eyebrow">Address</p>
          <p className="mt-1.5 text-[14.5px]" style={{ color: "var(--chalk-70)" }}>
            {v.address}
          </p>
        </section>

        <section className="card mt-8 p-5">
          <p className="eyebrow">Friend notes</p>
          <p className="mt-2 text-[14.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
            What your friends thought shows up here once they&apos;re on ROUND. Until then, ROUND&apos;s Take is the note.
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <Link href="/" className="pressable btn-ghost flex h-12 items-center px-5 text-[14px]">
            Where should we go?
          </Link>
        </div>

        {process.env.NODE_ENV !== "production" && !v.verified && (
          <p className="mt-6 text-center text-[11px]" style={{ color: "var(--chalk-35)" }}>
            Seed entry · not yet verified
          </p>
        )}
      </div>
    </main>
  );
}
