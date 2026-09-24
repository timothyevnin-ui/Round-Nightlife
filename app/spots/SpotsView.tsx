"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { VerifiedMark } from "@/components/VerifiedMark";
import { ScoreBadge } from "@/components/Score";
import { RateSheet, VERDICTS } from "@/components/RateSheet";
import { DisagreeSheet } from "@/components/DisagreeSheet";
import { BookmarkIcon, useSignInNudge } from "@/components/Actions";
import { useRoundStore } from "@/lib/store";
import { track } from "@/lib/track";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import type { NeighborhoodId, Venue } from "@/lib/types";

export type Spot = {
  slug: string;
  name: string;
  kind: "bar" | "restaurant";
  barFood: boolean;
  cuisine: string | null;
  neighborhood: NeighborhoodId;
  address: string;
  lat: number;
  lng: number;
  take: string;
  tags: string[];
  price: number;
  score: number | null;
  verified: boolean;
  desk: boolean;
  hot: boolean;
  photo: Venue["photo"];
  photoUrl?: string;
  crowd: { n: number; back: number } | null;
};

type Sort = "score" | "az";
const PAGE = 40;

/**
 * Every place on ROUND, one scroll. The take and ROUND's score lead; under
 * each, four things a person can do without leaving the list: Want to go,
 * Been, Rate it, and Disagree with our take. Search, a neighborhood, bars or
 * restaurants, best-first or A to Z.
 */
export function SpotsView({ spots }: { spots: Spot[] }) {
  const [q, setQ] = useState("");
  const [hood, setHood] = useState<string>("all");
  const [kind, setKind] = useState<"all" | "bar" | "restaurant">("all");
  const [sort, setSort] = useState<Sort>("score");
  const [shown, setShown] = useState(PAGE);
  const [rating, setRating] = useState<Spot | null>(null);
  const [disputing, setDisputing] = useState<Spot | null>(null);

  const names = useMemo(() => Object.fromEntries(spots.map((s) => [s.slug, s.name])), [spots]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of spots) m.set(s.neighborhood, (m.get(s.neighborhood) ?? 0) + 1);
    return m;
  }, [spots]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return spots
      .filter((s) => hood === "all" || s.neighborhood === hood)
      .filter((s) => kind === "all" || s.kind === kind)
      .filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.tags.some((t) => t.toLowerCase().includes(needle)) || (s.cuisine ?? "").toLowerCase().includes(needle) || neighborhoodName(s.neighborhood).toLowerCase().includes(needle))
      .sort((a, b) => (sort === "score" ? (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
  }, [spots, q, hood, kind, sort]);

  const visible = list.slice(0, shown);

  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-spots>
      <div className="pt-6">
        <p className="eyebrow">All of ROUND</p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1 }}>
            Spots.
          </h1>
          <Link href="/recommend" className="pressable btn-primary flex h-10 shrink-0 items-center gap-1.5 px-4 text-[13.5px]" data-spots-add>
            <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>
              +
            </span>
            Add a spot
          </Link>
        </div>
        <p className="mt-1.5 text-[14px]" style={{ color: "var(--ink-55)" }}>
          <span data-spots-count>{list.length === spots.length ? `${spots.length} places we stand behind` : `${list.length} of ${spots.length} places`}</span>, and your say on each. Disagree with a take and a person at ROUND reads it.
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-5 mt-4 px-5 pb-2 pt-2" style={{ background: "var(--paper)" }}>
        <label className="flex h-11 items-center gap-2 rounded-full border px-4" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search a spot, a tag, a cuisine" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" style={{ color: "var(--ink)" }} aria-label="Search spots" data-spots-search />
          {q && (
            <button onClick={() => setQ("")} className="pressable text-[12px]" style={{ color: "var(--ink-55)" }}>
              Clear
            </button>
          )}
        </label>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto" data-spots-hoods>
          <Chip on={hood === "all"} onClick={() => { setHood("all"); setShown(PAGE); }} label="Everywhere" />
          {NEIGHBORHOODS.filter((n) => counts.get(n.id)).map((n) => (
            <Chip key={n.id} on={hood === n.id} onClick={() => { setHood(n.id); setShown(PAGE); }} label={`${n.short ?? n.name} · ${counts.get(n.id)}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Kind" data-spots-kind>
            {(["all", "bar", "restaurant"] as const).map((k) => (
              <Chip key={k} on={kind === k} onClick={() => { setKind(k); setShown(PAGE); }} label={k === "all" ? "All" : k === "bar" ? "Bars" : "Restaurants"} small />
            ))}
          </div>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Sort" data-spots-sort>
            <Chip on={sort === "score"} onClick={() => setSort("score")} label="Best first" small />
            <Chip on={sort === "az"} onClick={() => setSort("az")} label="A–Z" small />
          </div>
        </div>
      </div>

      {spots.length === 0 && (
        <div className="card mt-6 px-5 py-8 text-center" data-spots-empty>
          <p className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
            Nothing on the list yet.
          </p>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            ROUND only shows places it has checked. The first ones are on their way.
          </p>
        </div>
      )}

      <ul className="mt-2 flex flex-col" data-spots-list>
        {visible.map((s) => (
          <SpotRow key={s.slug} spot={s} onRate={() => setRating(s)} onDisagree={() => setDisputing(s)} />
        ))}
      </ul>
      {list.length === 0 && spots.length > 0 && (
        <p className="py-10 text-center text-[14px]" style={{ color: "var(--ink-55)" }} data-spots-none>
          Nothing matches. Try another word, or another neighborhood.
        </p>
      )}
      {shown < list.length && (
        <button onClick={() => setShown((n) => n + PAGE)} className="pressable btn-ghost mt-4 flex h-12 w-full items-center justify-center text-[14px]" data-spots-more>
          Show {Math.min(PAGE, list.length - shown)} more · {list.length - shown} left
        </button>
      )}

      {rating && <RateSheet venue={rating} names={names} open onClose={() => setRating(null)} />}
      {disputing && <DisagreeSheet venue={disputing} open onClose={() => setDisputing(null)} />}
    </main>
  );
}

function SpotRow({ spot, onRate, onDisagree }: { spot: Spot; onRate: () => void; onDisagree: () => void }) {
  const { state, toggleSaved, markBeen, clearBeen } = useRoundStore();
  const nudge = useSignInNudge("keep");
  const saved = !!state.saved[spot.slug];
  const been = state.been[spot.slug];
  const verdict = been?.verdict ? VERDICTS.find((v) => v.key === been.verdict) : undefined;
  const meta = [neighborhoodName(spot.neighborhood), spot.kind === "restaurant" ? spot.cuisine || "Restaurant" : spot.barFood ? "Bar · kitchen" : "Bar", ...spot.tags.filter((t) => t !== spot.cuisine).slice(0, 2), "$".repeat(spot.price)].join(" · ");
  return (
    <li className="border-b py-4" style={{ borderColor: "var(--hairline)" }} data-spot={spot.slug}>
      <div className="flex gap-3">
        <Link href={`/v/${spot.slug}`} className="pressable shrink-0">
          <Photo venue={spot} className="h-[76px] w-[76px]" rounded="rounded-[18px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/v/${spot.slug}`} className="pressable min-w-0">
              <h2 className="serif truncate" style={{ fontSize: 22, lineHeight: 1.1 }}>
                {spot.name}
                {spot.verified && <VerifiedMark size={17} className="ml-1.5" />}
              </h2>
              <p className="truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                {meta}
              </p>
            </Link>
            <ScoreBadge score={spot.score ?? undefined} size={42} className="mt-0.5" />
          </div>
          <p className="mt-1.5 text-[14px] leading-snug" style={{ color: "var(--ink-70)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} data-spot-take>
            {spot.take}
          </p>
          {spot.crowd && spot.crowd.n >= 3 && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-55)" }}>
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {Math.round((spot.crowd.back / spot.crowd.n) * 100)}%
              </span>{" "}
              would go back · {spot.crowd.n} ratings
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" data-spot-actions>
        <Pill
          on={saved}
          onClick={() => {
            const now = toggleSaved(spot.slug, "venue");
            if (now) {
              nudge();
              track("save", { slug: spot.slug, data: { source: "spots" } });
            }
          }}
          tone="cobalt"
          label={saved ? "Want to go" : "Want to go"}
          icon={<BookmarkIcon filled={saved} />}
          data="want"
        />
        <Pill
          on={!!been}
          onClick={() => {
            if (been) clearBeen(spot.slug);
            else {
              markBeen(spot.slug);
              nudge();
            }
          }}
          tone="ink"
          label="Been"
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          data="been"
        />
        <Pill
          on={!!verdict}
          onClick={onRate}
          tone="ink"
          label={verdict ? verdict.label.replace(/\.$/, "") : "Rate"}
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="6" stroke="var(--tomato)" strokeWidth="2.2" />
            </svg>
          }
          data="rate"
        />
        <Pill on={false} onClick={onDisagree} tone="tomato" label="Disagree" data="disagree" />
      </div>
    </li>
  );
}

function Pill({ on, onClick, label, icon, tone, data }: { on: boolean; onClick: () => void; label: string; icon?: React.ReactNode; tone: "cobalt" | "ink" | "tomato"; data: string }) {
  const color = tone === "cobalt" ? "var(--cobalt)" : tone === "tomato" ? "var(--tomato)" : "var(--ink)";
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium"
      style={on ? { background: color, borderColor: color, color: "var(--paper)" } : { borderColor: "var(--hairline-strong)", color: tone === "tomato" ? "var(--tomato)" : "var(--ink-70)", background: "transparent" }}
      data-spot-action={data}
    >
      {icon}
      {label}
    </button>
  );
}

function Chip({ on, onClick, label, small = false }: { on: boolean; onClick: () => void; label: string; small?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`pressable shrink-0 rounded-full border font-medium ${small ? "h-8 px-2.5 text-[12px]" : "h-9 px-3 text-[13px]"}`} style={on ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)", background: "var(--surface)" }}>
      {label}
    </button>
  );
}
