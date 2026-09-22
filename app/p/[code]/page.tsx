import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { Photo } from "@/components/Photo";
import { GoButton, SaveButton } from "@/components/Actions";
import { LabelChip } from "@/components/VenueCard";
import { neighborhoodName } from "@/lib/neighborhoods";
import { decodePlan } from "@/lib/plan";
import { getVenues } from "@/lib/db";
import { venueMap } from "@/lib/venues";
import { formatHour } from "@/lib/time";

const LABELS = ["The pick", "Also great", "Easy in"] as const;

async function planTitle(code: string) {
  const plan = decodePlan(code, venueMap(await getVenues()));
  if (!plan) return null;
  const names = plan.stops.map((s) => (s.restaurant ? `${s.restaurant.name} → ${s.bar.name}` : s.bar.name));
  return { plan, names };
}

export async function generateMetadata({ params }: PageProps<"/p/[code]">): Promise<Metadata> {
  const { code } = await params;
  const t = await planTitle(code);
  if (!t) return { title: "Tonight" };
  const { plan, names } = t;
  const title = names.length === 1 ? names[0] : `Tonight: ${names.join(" · ")}`;
  const description =
    plan.m === "date"
      ? `ROUND planned the evening in ${neighborhoodName(plan.n)}. ${formatHour(plan.t, true)}.`
      : `ROUND says one of these in ${neighborhoodName(plan.n)} at ${formatHour(plan.t, true)}${plan.g ? ` for ${plan.g === 11 ? "11+" : plan.g}` : ""}. Tap one. Go.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PlanPage({ params }: PageProps<"/p/[code]">) {
  const { code } = await params;
  const plan = decodePlan(code, venueMap(await getVenues()));
  if (!plan) notFound();
  const multi = plan.stops.length > 1;

  return (
    <main className="screen mx-auto w-full max-w-md pb-16">
      <header className="flex items-center justify-between pt-5 pb-2">
        <Wordmark />
        <span className="eyebrow">{plan.m === "date" ? "Date" : "Night out"}</span>
      </header>

      <section className="pt-6 pb-6">
        <p className="eyebrow">
          {neighborhoodName(plan.n)} · {formatHour(plan.t, true)}
          {plan.g ? ` · ${plan.g === 11 ? "11+" : plan.g} of you` : ""}
        </p>
        <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
          {multi ? (
            <>
              ROUND says
              <br />
              <span style={{ color: "var(--chalk-55)" }}>one of these.</span>
            </>
          ) : plan.m === "date" && plan.stops[0].restaurant ? (
            "Tonight's plan."
          ) : (
            "Tonight."
          )}
        </h1>
      </section>

      <section className="flex flex-col gap-4">
        {plan.stops.map((s, i) => (
          <article key={`${s.restaurant?.slug ?? ""}-${s.bar.slug}`} className="card overflow-hidden">
            {s.restaurant ? (
              <div className="p-5">
                {multi && <LabelChip label={LABELS[i] ?? "Also great"} />}
                <Stop eyebrow={`Dinner · ${formatHour(s.dinnerAt ?? plan.t, true)}`} venue={s.restaurant} />
                <div className="ml-[35px] flex items-center gap-3 py-1.5">
                  <span className="block h-7 w-px" style={{ background: "var(--hairline-strong)" }} />
                  <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
                    {s.walk ?? 5} min walk
                  </span>
                </div>
                <Stop eyebrow={`Drinks · ${formatHour(s.drinksAt ?? plan.t + 1.75, true)}`} venue={s.bar} />
                <div className="mt-5 flex items-center gap-2.5">
                  <GoButton venue={s.restaurant} className="flex-1" />
                  <SaveButton slug={s.restaurant.slug} />
                </div>
              </div>
            ) : (
              <>
                <Link href={`/v/${s.bar.slug}`} className="block">
                  <Photo venue={s.bar} rounded="rounded-none" className="aspect-[16/10] w-full">
                    {multi && <div className="absolute left-4 top-4"><LabelChip label={LABELS[i] ?? "Also great"} /></div>}
                  </Photo>
                </Link>
                <div className="px-5 pb-5 pt-4">
                  <h2 className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
                    {s.bar.name}
                  </h2>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--chalk-55)" }}>
                    {neighborhoodName(s.bar.neighborhood)}
                  </p>
                  <p className="mt-3 text-[15px] leading-[1.45]" style={{ color: "var(--chalk-70)" }}>
                    {s.bar.take}
                  </p>
                  <div className="mt-5 flex items-center gap-2.5">
                    <GoButton venue={s.bar} className="flex-1" />
                    <SaveButton slug={s.bar.slug} />
                  </div>
                </div>
              </>
            )}
          </article>
        ))}
      </section>

      <section className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px]" style={{ color: "var(--chalk-55)" }}>
          Sent from ROUND. Tell it your night, get three places.
        </p>
        <Link href="/" className="pressable btn-cobalt flex h-12 items-center px-6 text-[14px]">
          Plan your own
        </Link>
      </section>
    </main>
  );
}

function Stop({ eyebrow, venue }: { eyebrow: string; venue: NonNullable<ReturnType<typeof decodePlan>>["stops"][number]["bar"] }) {
  return (
    <Link href={`/v/${venue.slug}`} className="pressable mt-4 flex items-center gap-4">
      <Photo venue={venue} rounded="rounded-[16px]" className="h-[70px] w-[70px] shrink-0" />
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="serif mt-0.5 truncate" style={{ fontSize: 24, lineHeight: 1.1 }}>
          {venue.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
          {venue.take}
        </p>
      </div>
    </Link>
  );
}
