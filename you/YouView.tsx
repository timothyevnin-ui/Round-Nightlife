"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { Photo } from "@/components/Photo";
import { useRoundStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { prettyPhone } from "@/lib/phone";
import { venueMap } from "@/lib/venues";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

const NightMap = dynamic(() => import("@/components/NightMap").then((m) => m.NightMap), {
  ssr: false,
  loading: () => (
    <div className="rounded-[24px] border" style={{ height: 300, borderColor: "var(--hairline)", background: "var(--paper-2)" }} />
  ),
});

export function YouView({ venues }: { venues: Venue[] }) {
  const { state } = useRoundStore();
  const byslug = useMemo(() => venueMap(venues), [venues]);
  const [selected, setSelected] = useState<Venue | null>(null);
  const onSelect = useCallback((v: Venue | null) => setSelected(v), []);

  const savedSet = useMemo(() => new Set(Object.keys(state.saved)), [state.saved]);
  const beenSet = useMemo(() => new Set(Object.keys(state.been)), [state.been]);

  const saved = Object.entries(state.saved)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([slug]) => byslug[slug])
    .filter((v): v is Venue => !!v);
  const been = Object.entries(state.been)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([slug, e]) => ({ venue: byslug[slug], entry: e }))
    .filter((x): x is { venue: Venue; entry: (typeof state.been)[string] } => !!x.venue);

  const taste = tasteLine(been.map((b) => b.venue), state.been);

  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <header className="flex items-end justify-between pt-5 pb-4">
        <div>
          <p className="eyebrow">Your NYC</p>
          <h1 className="serif mt-1" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
            You
          </h1>
        </div>
        <p className="pb-1 text-right text-[12.5px]" style={{ color: "var(--chalk-55)" }}>
          {saved.length} want to go
          <br />
          {been.length} been
        </p>
      </header>

      <section className="relative">
        <NightMap venues={venues} saved={savedSet} been={beenSet} onSelect={onSelect} height={300} />
        <div className="pointer-events-none absolute left-4 top-4 flex gap-3 text-[11px]" style={{ color: "var(--chalk-70)" }}>
          <Legend color="#d9482b" label="Want to go" ring />
          <Legend color="#16213a" label="Been" />
          <Legend color="rgba(22,33,58,0.35)" label="On ROUND" small />
        </div>
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-3 bottom-3"
            >
              <Link href={`/v/${selected.slug}`} className="pressable card flex items-center gap-3 p-3" style={{ background: "rgba(251,248,241,0.94)", backdropFilter: "blur(12px)" }}>
                <Photo venue={selected} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                    {selected.name}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                    {neighborhoodName(selected.neighborhood)} · {selected.tags.slice(0, 2).join(" · ")}
                  </p>
                </div>
                <span className="text-[12px] font-medium" style={{ color: "var(--chalk-70)" }}>
                  Open
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {taste && (
        <p className="mt-4 text-[13.5px]" style={{ color: "var(--chalk-55)" }}>
          {taste}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/you/add" className="pressable card flex min-h-[124px] flex-col justify-between p-4">
          <ScreenshotIcon />
          <div>
            <p className="text-[15px] font-medium">Add from screenshots</p>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--chalk-55)" }}>
              TikToks, Reels, texts. ROUND reads them.
            </p>
          </div>
        </Link>
        <Link
          href="/quiz"
          className="pressable flex min-h-[124px] flex-col justify-between rounded-[28px] p-4"
          style={{ background: state.quizDone ? "var(--surface)" : "linear-gradient(160deg, #143327, #2e6b52)", color: state.quizDone ? "var(--ink)" : "var(--on-photo)", border: "1px solid var(--hairline)" }}
        >
          <QuizIcon />
          <div>
            <p className="text-[15px] font-medium">{state.quizDone ? "Retake the taste quiz" : "30-second taste quiz"}</p>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: state.quizDone ? "var(--ink-55)" : "var(--on-photo-80)" }}>
              Ten bars. Swipe. ROUND learns you.
            </p>
          </div>
        </Link>
      </section>

      <Section title="Want to go" count={saved.length} empty="Save places from results, venue pages, or your screenshots.">
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {saved.map((v) => (
            <Link key={v.slug} href={`/v/${v.slug}`} className="pressable w-[150px] shrink-0">
              <Photo venue={v} rounded="rounded-[18px]" className="aspect-[4/5] w-full" />
              <p className="serif mt-2 truncate" style={{ fontSize: 18, lineHeight: 1.1 }}>
                {v.name}
              </p>
              <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                {neighborhoodName(v.neighborhood)}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Been" count={been.length} empty="Places you've been, rated the morning after, become your ranked list.">
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          {been.map(({ venue, entry }) => (
            <Link key={venue.slug} href={`/v/${venue.slug}`} className="pressable flex items-center gap-3 py-3" style={{ borderColor: "var(--hairline)" }}>
              <Photo venue={venue} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                  {venue.name}
                </p>
                <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                  {neighborhoodName(venue.neighborhood)}
                </p>
              </div>
              <span className="text-[12px] font-medium" style={{ color: entry.rating ? "var(--chalk)" : "var(--chalk-35)" }}>
                {entry.rating === "loved" ? "Loved" : entry.rating === "good" ? "Good" : entry.rating === "meh" ? "Meh" : "Rate"}
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <AccountCard count={saved.length + been.length} />
    </main>
  );
}

function AccountCard({ count }: { count: number }) {
  const { enabled, ready, user, profile, needsProfile, openSignIn, signOut } = useAuth();
  if (!enabled) {
    return (
      <p className="mt-10 text-center text-[12px] leading-relaxed" style={{ color: "var(--chalk-35)" }}>
        Everything here lives on this phone for now.
      </p>
    );
  }
  if (!ready) return <div className="mt-8 h-[92px]" />;
  if (user && !needsProfile) {
    return (
      <section className="card mt-8 flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full serif text-[20px]" style={{ background: "rgba(43,77,255,0.22)", color: "var(--chalk)" }}>
          {(profile?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{profile?.name}</p>
          <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
            {prettyPhone(user.phone)} · saved to your account
          </p>
        </div>
        <button onClick={() => signOut()} className="pressable text-[12.5px] font-medium" style={{ color: "var(--chalk-55)" }}>
          Sign out
        </button>
      </section>
    );
  }
  return (
    <section className="card mt-8 p-4" style={{ borderColor: "rgba(43,77,255,0.45)" }}>
      <p className="eyebrow" style={{ color: "var(--tomato)" }}>
        {needsProfile ? "One more step" : "This phone only"}
      </p>
      <p className="serif mt-1" style={{ fontSize: 24, lineHeight: 1.05 }}>
        {needsProfile ? "Finish setting up." : count > 0 ? "Keep your map." : "Make it yours."}
      </p>
      <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--chalk-55)" }}>
        {needsProfile ? "A first name and your birthday, and your places are locked in." : "Add your number and everything you save follows you to any phone."}
      </p>
      <button onClick={() => openSignIn("you")} className="pressable btn-cobalt mt-3 flex h-12 w-full items-center justify-center text-[14px]">
        {needsProfile ? "Finish" : "Add your number"}
      </button>
    </section>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="serif" style={{ fontSize: 26, letterSpacing: "-0.01em" }}>
          {title}
        </h2>
        <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
          {count}
        </span>
      </div>
      <div className="mt-3">
        {count === 0 ? (
          <p className="text-[13.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Legend({ color, label, ring, small }: { color: string; label: string; ring?: boolean; small?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full px-2 py-1" style={{ background: "rgba(243,237,224,0.82)", backdropFilter: "blur(8px)" }}>
      <span
        className="block rounded-full"
        style={{
          width: small ? 8 : 10,
          height: small ? 8 : 10,
          background: color,
          boxShadow: ring ? "0 0 0 2px rgba(43,77,255,0.35)" : undefined,
        }}
      />
      {label}
    </span>
  );
}

function tasteLine(venues: Venue[], been: Record<string, { rating?: string }>) {
  const loved = venues.filter((v) => been[v.slug]?.rating === "loved");
  const pool = loved.length >= 2 ? loved : venues;
  if (pool.length < 2) return null;
  const sums = { lively: 0, chill: 0, talk: 0 };
  const tags: Record<string, number> = {};
  for (const v of pool) {
    sums.lively += v.attrs.lively;
    sums.chill += v.attrs.chill;
    sums.talk += v.attrs.talk;
    for (const t of v.tags) tags[t] = (tags[t] ?? 0) + 1;
  }
  const vibe = (Object.entries(sums).sort((a, b) => b[1] - a[1])[0][0] as "lively" | "chill" | "talk");
  const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0]?.[0];
  const word = { lively: "lively rooms", chill: "slow nights", talk: "places you can talk" }[vibe];
  return `Your taste leans toward ${word}${topTag ? ` and ${topTag.toLowerCase()}` : ""}. ROUND is already using it.`;
}

function ScreenshotIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect x="4" y="3" width="18" height="20" rx="4" stroke="#16213A" strokeWidth="1.6" />
      <path d="M8 16l3.5-3.5 3 3 2-2L19 17" stroke="#D9482B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="9" r="1.5" fill="#D9482B" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect x="6" y="4" width="14" height="18" rx="3.5" stroke="#F6F1E7" strokeWidth="1.6" transform="rotate(-8 13 13)" />
      <rect x="9" y="6" width="14" height="18" rx="3.5" stroke="#F6F1E7" strokeWidth="1.6" opacity="0.5" transform="rotate(6 16 15)" />
    </svg>
  );
}
