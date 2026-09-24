"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Photo } from "@/components/Photo";
import { VerifiedMark } from "@/components/VerifiedMark";
import { ScoreBadge } from "@/components/Score";
import { RateSheet, VERDICTS } from "@/components/RateSheet";
import { DisagreeSheet } from "@/components/DisagreeSheet";
import { BookmarkIcon, useSignInNudge } from "@/components/Actions";
import { Legend } from "@/components/MapSheet";
import type { NightMapProps } from "@/components/NightMap";
import { useRoundStore } from "@/lib/store";
import { track } from "@/lib/track";
import { locate } from "@/lib/locate";
import { nowInNewYork, openWord, type OpenWord } from "@/lib/hours";
import { metersBetween, walkMinutes, type Point } from "@/lib/where";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import type { Hours, NeighborhoodId, Venue } from "@/lib/types";

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
  hours: Hours | null;
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

const subscribeMinute = (cb: () => void) => {
  const t = window.setInterval(cb, 60_000);
  return () => window.clearInterval(t);
};
const readNow = () => {
  const n = nowInNewYork();
  return `${n.dow}|${Math.round(n.hour * 60)}`;
};

const NightMap = dynamic(() => import("@/components/NightMap").then((m) => m.NightMap as ComponentType<NightMapProps<Spot>>), { ssr: false });

type Sort = "score" | "az" | "near";
type View = "map" | "list";
const PAGE = 40;
/** Where the map opens with no one on it: downtown, all of ROUND in frame. */
const HOME = { lat: 40.7275, lng: -73.99, zoom: 12.6 };

/**
 * Every place on ROUND. The map comes first: pins for every spot, the blue
 * dot for you once you allow it, a card for whichever pin you tap, and the
 * same four things you can do anywhere on ROUND (Want to go, Been, Rate,
 * Disagree). The list is one tap away, with the take and the score on each
 * row, "Open till 2am" from the posted hours, and Closest first when the app
 * knows where you are. Search and the filters work on both.
 */
export function SpotsView({ spots }: { spots: Spot[] }) {
  const [view, setView] = useState<View>("map");
  const [q, setQ] = useState("");
  const [hood, setHood] = useState<string>("all");
  const [kind, setKind] = useState<"all" | "bar" | "restaurant">("all");
  const [sort, setSort] = useState<Sort>("score");
  const [shown, setShown] = useState(PAGE);
  const [rating, setRating] = useState<Spot | null>(null);
  const [disputing, setDisputing] = useState<Spot | null>(null);
  const [selected, setSelected] = useState<Spot | null>(null);
  const [me, setMe] = useState<Point | null>(null);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom?: number; key: number } | undefined>();
  const { state } = useRoundStore();

  // The phone's clock, on the client only (the server can't know it), for "Open till 2am"; re-read each minute.
  const nowKey = useSyncExternalStore(subscribeMinute, readNow, () => "");
  const now = useMemo(() => {
    if (!nowKey) return null;
    const [d, m] = nowKey.split("|").map(Number);
    return { dow: d, hour: m / 60 };
  }, [nowKey]);

  // If the phone already shares where it is, the dot is on the map from the start; no prompt from here.
  useEffect(() => {
    let live = true;
    locate("silent").then((p) => {
      if (!live || !p) return;
      setMe(p);
      setFly({ ...p, zoom: 14.2, key: 1 });
    });
    return () => {
      live = false;
    };
  }, []);

  const locateMe = useCallback(async () => {
    setAsking(true);
    const p = await locate("ask");
    setAsking(false);
    if (!p) return setDenied(true);
    setMe(p);
    setFly({ ...p, zoom: 15, key: Date.now() });
  }, []);

  const names = useMemo(() => Object.fromEntries(spots.map((s) => [s.slug, s.name])), [spots]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of spots) m.set(s.neighborhood, (m.get(s.neighborhood) ?? 0) + 1);
    return m;
  }, [spots]);
  const saved = useMemo(() => new Set(Object.keys(state.saved).filter((k) => state.saved[k])), [state.saved]);
  const been = useMemo(() => new Set(Object.keys(state.been)), [state.been]);
  const walk = useCallback((s: Spot) => (me ? walkMinutes(metersBetween(me, s)) : null), [me]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const by = sort === "near" && me ? "near" : sort === "near" ? "score" : sort;
    return spots
      .filter((s) => hood === "all" || s.neighborhood === hood)
      .filter((s) => kind === "all" || s.kind === kind)
      .filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.tags.some((t) => t.toLowerCase().includes(needle)) || (s.cuisine ?? "").toLowerCase().includes(needle) || neighborhoodName(s.neighborhood).toLowerCase().includes(needle))
      .sort((a, b) =>
        by === "near" && me
          ? metersBetween(me, a) - metersBetween(me, b)
          : by === "score"
            ? (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name),
      );
  }, [spots, q, hood, kind, sort, me]);

  const visible = list.slice(0, shown);
  const onPin = useCallback((s: Spot | null) => setSelected(s), []);
  const filtered = list.length !== spots.length;

  // The map takes everything between the header and the tab bar.
  const headRef = useRef<HTMLDivElement | null>(null);
  const [mapHeight, setMapHeight] = useState<number>(480);
  useEffect(() => {
    if (view !== "map") return;
    const fit = () => {
      const top = headRef.current?.getBoundingClientRect().bottom ?? 160;
      const tab = 72 + 8;
      setMapHeight(Math.max(360, window.innerHeight - top - tab));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [view]);

  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-spots data-view={view}>
      <div ref={headRef} className="sticky top-0 z-20 -mx-5 px-5 pb-2 pt-4" style={{ background: "var(--paper)" }}>
        <div className="flex items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border px-4" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Search our spots"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              style={{ color: "var(--ink)" }}
              aria-label="Search spots"
              data-spots-search
            />
            {q && (
              <button onClick={() => setQ("")} className="pressable text-[12px]" style={{ color: "var(--ink-55)" }}>
                Clear
              </button>
            )}
          </label>
          <Link href="/recommend" className="pressable btn-primary flex h-11 shrink-0 items-center gap-1 px-3.5 text-[13.5px]" data-spots-add>
            <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>
              +
            </span>
            Add a spot
          </Link>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex rounded-full border p-0.5" style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }} role="tablist" aria-label="Map or list" data-spots-view>
            {(["map", "list"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => {
                  setView(v);
                  setSelected(null);
                }}
                className="pressable flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium"
                style={view === v ? { background: "var(--ink)", color: "var(--paper)" } : { color: "var(--ink-70)" }}
                data-view-btn={v}
              >
                {v === "map" ? <PinIcon /> : <ListIcon />}
                {v === "map" ? "Map" : "List"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Kind" data-spots-kind>
            {(["all", "bar", "restaurant"] as const).map((k) => (
              <Chip
                key={k}
                on={kind === k}
                onClick={() => {
                  setKind(k);
                  setShown(PAGE);
                }}
                label={k === "all" ? "All" : k === "bar" ? "Bars" : "Restaurants"}
                small
              />
            ))}
          </div>
        </div>
        {view === "list" && (
          <>
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto" data-spots-hoods>
              <Chip
                on={hood === "all"}
                onClick={() => {
                  setHood("all");
                  setShown(PAGE);
                }}
                label="Everywhere"
              />
              {NEIGHBORHOODS.filter((n) => counts.get(n.id)).map((n) => (
                <Chip
                  key={n.id}
                  on={hood === n.id}
                  onClick={() => {
                    setHood(n.id);
                    setShown(PAGE);
                  }}
                  label={`${n.short ?? n.name} · ${counts.get(n.id)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                <span data-spots-count>{!filtered ? `${spots.length} places we stand behind` : `${list.length} of ${spots.length} places`}</span>
              </p>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Sort" data-spots-sort>
                <Chip on={sort === "score"} onClick={() => setSort("score")} label="Best first" small />
                <Chip on={sort === "az"} onClick={() => setSort("az")} label="A–Z" small />
                {me && <Chip on={sort === "near"} onClick={() => setSort("near")} label="Closest" small />}
              </div>
            </div>
          </>
        )}
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

      {view === "map" && spots.length > 0 && (
        <div className="relative -mx-5 mt-1 overflow-hidden" style={{ height: mapHeight, borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }} data-spots-map>
          <NightMap venues={list} saved={saved} been={been} onSelect={onPin} height="100%" interactive rounded={false} focus={HOME} you={me} flyTo={fly} selected={selected?.slug ?? null} big controls="top-right" />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5 text-[11px]" style={{ color: "var(--chalk-70)" }}>
            <span className="rounded-full px-2.5 py-1 font-medium" style={{ background: "rgba(243,237,224,0.92)", color: "var(--ink)", backdropFilter: "blur(8px)" }} data-spots-count>
              {!filtered ? `${spots.length} spots · Manhattan` : `${list.length} of ${spots.length} spots`}
            </span>
            <Legend color="#d9482b" label="Want to go" ring />
            <Legend color="#16213a" label="Been" />
          </div>
          <button
            type="button"
            onClick={locateMe}
            className="pressable absolute right-3 flex h-11 w-11 items-center justify-center rounded-full border"
            style={{ bottom: selected ? 196 : 14, background: "rgba(251,248,241,0.96)", borderColor: "var(--hairline-strong)", backdropFilter: "blur(10px)", transition: "bottom 200ms" }}
            aria-label={me ? "Center on me" : "Show me on the map"}
            data-spots-locate
            data-located={me ? "1" : "0"}
          >
            {asking ? (
              <span className="block h-3 w-3 animate-pulse rounded-full" style={{ background: "#1f6fe0" }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="3" fill={me ? "#1f6fe0" : "none"} stroke={me ? "#1f6fe0" : "currentColor"} strokeWidth="1.8" />
                <circle cx="10" cy="10" r="6.5" stroke={me ? "#1f6fe0" : "currentColor"} strokeWidth="1.6" />
                <path d="M10 1v2.5M10 16.5V19M1 10h2.5M16.5 10H19" stroke={me ? "#1f6fe0" : "currentColor"} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
          {!me && denied && (
            <p className="pointer-events-none absolute bottom-4 left-3 rounded-full px-2.5 py-1 text-[11px]" style={{ background: "rgba(243,237,224,0.92)", color: "var(--ink-55)" }}>
              Location is off for ROUND. Turn it on in Settings to see yourself here.
            </p>
          )}
          {list.length === 0 && (
            <p className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[14px]" style={{ color: "var(--ink-55)" }} data-spots-none>
              Nothing matches. Try another word.
            </p>
          )}
          <AnimatePresence>
            {selected && (
              <motion.div key={selected.slug} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} transition={{ duration: 0.18 }} className="absolute inset-x-3 bottom-3" data-spot-card={selected.slug}>
                <div className="card p-3" style={{ background: "rgba(251,248,241,0.97)", backdropFilter: "blur(12px)" }}>
                  <div className="flex gap-3">
                    <Link href={`/v/${selected.slug}`} className="pressable shrink-0">
                      <Photo venue={selected} className="h-[68px] w-[68px]" rounded="rounded-[16px]" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/v/${selected.slug}`} className="pressable min-w-0">
                          <p className="serif truncate" style={{ fontSize: 21, lineHeight: 1.1 }}>
                            {selected.name}
                            {selected.verified && <VerifiedMark size={16} className="ml-1.5" />}
                          </p>
                          <p className="truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                            {metaLine(selected)}
                          </p>
                        </Link>
                        <ScoreBadge score={selected.score ?? undefined} size={38} />
                      </div>
                      <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--ink-70)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} data-spot-take>
                        {selected.take}
                      </p>
                      <StatusLine word={now ? openWord(selected.hours ?? undefined, now.dow, now.hour) : null} walk={walk(selected)} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <SpotActions spot={selected} onRate={() => setRating(selected)} onDisagree={() => setDisputing(selected)} />
                    <Link href={`/v/${selected.slug}`} className="pressable ml-auto flex h-9 shrink-0 items-center pl-1 text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }} data-spot-open-page>
                      Open →
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {view === "list" && (
        <>
          <ul className="mt-1 flex flex-col" data-spots-list>
            {visible.map((s) => (
              <SpotRow key={s.slug} spot={s} word={now ? openWord(s.hours ?? undefined, now.dow, now.hour) : null} walk={walk(s)} onRate={() => setRating(s)} onDisagree={() => setDisputing(s)} />
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
          <p className="mt-6 text-center text-[12.5px]" style={{ color: "var(--ink-35)" }}>
            Disagree with a take and a person at ROUND reads it.
          </p>
        </>
      )}

      {rating && <RateSheet venue={rating} names={names} open onClose={() => setRating(null)} />}
      {disputing && <DisagreeSheet venue={disputing} open onClose={() => setDisputing(null)} />}
    </main>
  );
}

function metaLine(spot: Spot) {
  return [neighborhoodName(spot.neighborhood), spot.kind === "restaurant" ? spot.cuisine || "Restaurant" : spot.barFood ? "Bar · kitchen" : "Bar", ...spot.tags.filter((t) => t !== spot.cuisine).slice(0, 2), "$".repeat(spot.price)].join(" · ");
}

/** "Open till 2am · 4 min walk", in the colors that mean it. */
function StatusLine({ word, walk }: { word: OpenWord | null; walk: number | null }) {
  if (!word && walk === null) return null;
  const color = word?.state === "open" ? "var(--pine)" : word?.state === "later" ? "var(--ink-70)" : "var(--ink-55)";
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px]" data-spot-status>
      {word && (
        <span className="flex items-center gap-1 font-medium" style={{ color }} data-spot-open={word.state}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: word.state === "open" ? "var(--pine)" : "var(--ink-35)" }} aria-hidden />
          {word.text}
        </span>
      )}
      {word && walk !== null && <span style={{ color: "var(--ink-35)" }}>·</span>}
      {walk !== null && (
        <span style={{ color: "var(--ink-55)" }} data-spot-walk>
          {Math.max(1, walk)} min walk
        </span>
      )}
    </p>
  );
}

function SpotRow({ spot, word, walk, onRate, onDisagree }: { spot: Spot; word: OpenWord | null; walk: number | null; onRate: () => void; onDisagree: () => void }) {
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
                {metaLine(spot)}
              </p>
            </Link>
            <ScoreBadge score={spot.score ?? undefined} size={42} className="mt-0.5" />
          </div>
          <p className="mt-1.5 text-[14px] leading-snug" style={{ color: "var(--ink-70)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} data-spot-take>
            {spot.take}
          </p>
          <StatusLine word={word} walk={walk} />
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
        <SpotActions spot={spot} onRate={onRate} onDisagree={onDisagree} />
      </div>
    </li>
  );
}

/** Want to go · Been · Rate · Disagree: the same four on a row and on the map card. */
function SpotActions({ spot, onRate, onDisagree }: { spot: Spot; onRate: () => void; onDisagree: () => void }) {
  const { state, toggleSaved, markBeen, clearBeen } = useRoundStore();
  const nudge = useSignInNudge("keep");
  const saved = !!state.saved[spot.slug];
  const been = state.been[spot.slug];
  const verdict = been?.verdict ? VERDICTS.find((v) => v.key === been.verdict) : undefined;
  return (
    <>
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
        label="Want to go"
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
    </>
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

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 1 0-9 0c0 3.8 4.5 8 4.5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8" cy="6.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
