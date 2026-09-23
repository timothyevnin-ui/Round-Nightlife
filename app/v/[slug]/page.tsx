import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifiedLine, VerifiedMark } from "@/components/VerifiedMark";
import { Photo } from "@/components/Photo";
import { TrackView } from "@/components/TrackView";
import { FriendsChip } from "@/components/VenueCard";
import { VenueActions } from "./VenueActions";
import { StudioBar } from "@/components/StudioBar";
import { BackButton } from "@/components/BackButton";
import { priceLabel } from "@/lib/describe";
import { HoursLine, HoursWeek } from "@/components/Hours";
import { DayDeal } from "@/components/ResultCard";
import { CrowdLine, ScoreBadge } from "@/components/Score";
import { crowdScores } from "@/lib/crowd";
import { neighborhoodName } from "@/lib/neighborhoods";
import { encodePlan } from "@/lib/plan";
import { SEED_VENUES } from "@/lib/venues";
import { getVenue, getVenues } from "@/lib/db";
import { strongAttrLabels } from "@/lib/engine";
import type { Venue } from "@/lib/types";
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
  const [all, crowd] = await Promise.all([getVenues(), crowdScores([v.slug])]);
  const names: Record<string, string> = Object.fromEntries(all.map((x) => [x.slug, x.name]));

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

      <div className="screen" style={{ minHeight: 0, paddingTop: 20 }}>
        {/* ROUND says, first: the reason this place is on the list. */}
        <section className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow" style={{ color: "var(--tomato)" }}>
              ROUND says
            </p>
            <p className="serif mt-1.5" style={{ fontSize: 24, lineHeight: 1.25 }}>
              {v.take}
            </p>
            <CrowdLine crowd={crowd[v.slug]} className="mt-2" />
          </div>
          <ScoreBadge score={v.score} size={64} className="mt-1" />
        </section>

        <p className="eyebrow mt-7">
          {neighborhoodName(v.neighborhood)} · {kindWord(v)}
          {v.hot && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>
              HOT RIGHT NOW
            </span>
          )}
        </p>
        <h1 className="serif mt-1.5" style={{ fontSize: 38, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          {v.name}
          {v.verified && <VerifiedMark size={26} className="ml-2.5" />}
        </h1>
        <p className="mt-2.5 text-[13px] font-medium tracking-wide" style={{ color: "var(--chalk-55)" }}>
          {keywords(v).join(" · ")}
        </p>
        <VerifiedLine verified={!!v.verified} />

        <VenueActions venue={v} shareUrl={`/p/${shareCode}`} names={names} />
        <StudioBar slug={v.slug} verified={!!v.verified} />

        {(v.hours || v.dayDeal) && (
          <section className="mt-7 border-t pt-5" style={{ borderColor: "var(--hairline)" }}>
            <p className="eyebrow">Hours</p>
            <div className="mt-2">
              {v.hours && <HoursLine hours={v.hours} expandable={false} />}
              <DayDeal text={v.dayDeal} />
              {v.hours && <HoursWeek hours={v.hours} className="mt-3" />}
            </div>
          </section>
        )}

        {v.theCatch && (
          <p className="mt-5 text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }} data-catch>
            <span className="font-semibold" style={{ color: "var(--ink-70)" }}>
              Heads up.
            </span>{" "}
            {v.theCatch}
          </p>
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

        <section className="mt-7 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          <p className="eyebrow">Address</p>
          <p className="mt-1.5 text-[14.5px]" style={{ color: "var(--chalk-70)" }}>
            {v.address}
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <Link href="/" className="pressable btn-ghost flex h-12 items-center px-5 text-[14px]">
            Where should we go?
          </Link>
        </div>

      </div>
    </main>
  );
}

/** "Bar", "Bar · kitchen", "Restaurant". */
function kindWord(v: Venue) {
  return v.kind === "restaurant" ? "Restaurant" : v.barFood ? "Bar · kitchen" : "Bar";
}

/** The keywords line: what kind of food, the tags (or the strongest attributes), the price. */
function keywords(v: Venue): string[] {
  const words = [...(v.cuisine ? [v.cuisine] : []), ...(v.tags.length ? v.tags : strongAttrLabels(v))];
  return [...new Set(words)].slice(0, 5).concat(priceLabel(v.price));
}
