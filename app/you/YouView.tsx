"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { Photo } from "@/components/Photo";
import { useRoundStore, usualAnswers, type RoundState } from "@/lib/store";
import { CARDS } from "@/lib/questions";
import { ROOM_TAGS } from "@/components/RateSheet";
import { useAuth } from "@/lib/auth";
import { AboutYou, Avatar, FUN } from "@/components/AboutYou";
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

  const ladder = (state.ladder ?? [])
    .map((slug) => ({ venue: byslug[slug], entry: state.been[slug] }))
    .filter((x): x is { venue: Venue; entry: (typeof state.been)[string] } => !!x.venue && !!x.entry);

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

      <Link href="/search" className="pressable mt-6 flex h-12 items-center gap-3 rounded-full border px-4" style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }} aria-label="Search a bar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="#16213A" strokeWidth="1.6" />
          <path d="M10.5 10.5 14 14" stroke="#16213A" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="truncate text-[14px]" style={{ color: "var(--ink-55)" }}>
          Search a bar
        </span>
      </Link>

      <Learned state={state} byslug={byslug} />

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/recommend" className="pressable card flex min-h-[124px] flex-col justify-between p-4">
          <RecommendIcon />
          <div>
            <p className="text-[15px] font-medium">Know a spot we don&apos;t?</p>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--chalk-55)" }}>
              Recommend a bar. Two minutes. We check every one.
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

      <Section title="Want to go" count={saved.length} empty="Save places from results and venue pages.">
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

      <div id="ladder" className="scroll-mt-4" />
      <Section title="Your ladder" count={ladder.length} empty="Rate a place you've been and it takes its spot here, best first. Your ladder shapes ROUND's picks for you.">
        <ol className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          {ladder.map(({ venue, entry }, i) => (
            <li key={venue.slug}>
              <Link href={`/v/${venue.slug}`} className="pressable flex items-center gap-3 py-3" style={{ borderColor: "var(--hairline)" }}>
                <span className="serif w-7 shrink-0 text-right" style={{ fontSize: 22, color: i === 0 ? "var(--tomato)" : "var(--chalk-35)" }}>
                  {i + 1}
                </span>
                <Photo venue={venue} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                    {venue.name}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                    {entry.note ? `“${entry.note}”` : entry.verdict === "again" ? "Take me back tonight" : "I'd go back"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
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
              <span className="text-[12px] font-medium" style={{ color: entry.verdict || entry.rating ? "var(--chalk)" : "var(--chalk-35)" }}>
                {entry.verdict === "again" ? "Take me back" : entry.verdict === "back" ? "I'd go back" : entry.verdict === "fine" ? "Fine" : entry.verdict === "never" ? "Never again" : entry.rating === "loved" ? "Loved" : entry.rating === "good" ? "Good" : entry.rating === "meh" ? "Meh" : "Rate"}
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
  const [editing, setEditing] = useState(false);
  if (!enabled) {
    return (
      <p className="mt-10 text-center text-[12px] leading-relaxed" style={{ color: "var(--chalk-35)" }}>
        Everything here lives on this phone for now.
      </p>
    );
  }
  if (!ready) return <div className="mt-8 h-[92px]" />;
  if (user && !needsProfile) {
    const about = [profile?.hometown ? `From ${profile.hometown}` : null, profile?.fav_bar ? `Favorite bar: ${profile.fav_bar}` : null, profile?.fav_restaurant ? `Favorite restaurant: ${profile.fav_restaurant}` : null].filter(Boolean) as string[];
    const fun = Object.entries(profile?.fun ?? {})
      .map(([k, v]) => ({ q: FUN.find((f) => f.key === k)?.prompt.replace(/\?$/, ""), v }))
      .filter((x) => x.q && x.v);
    return (
      <section className="card mt-8 p-4" data-account-card>
        <div className="flex items-center gap-3">
          <Avatar url={profile?.avatar_url} name={profile?.name} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{profile?.name}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
              {prettyPhone(user.phone)} · saved to your account
            </p>
          </div>
          <button onClick={() => setEditing(true)} className="pressable btn-ghost h-9 px-3 text-[12.5px]" data-edit-about>
            {about.length || fun.length || profile?.avatar_url ? "Edit" : "About you"}
          </button>
        </div>
        {(about.length > 0 || fun.length > 0) && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--hairline)" }} data-about-lines>
            {about.length > 0 && (
              <p className="text-[13px] leading-snug" style={{ color: "var(--chalk-70, var(--chalk))" }}>
                {about.join(" · ")}
              </p>
            )}
            {fun.length > 0 && (
              <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
                {fun.map((x) => `${x.q}: ${x.v}`).join(" · ")}
              </p>
            )}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button onClick={() => signOut()} className="pressable text-[12.5px] font-medium" style={{ color: "var(--chalk-55)" }}>
            Sign out
          </button>
        </div>
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={() => setEditing(false)} role="dialog" aria-modal>
              <motion.div initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-[28px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
                <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--chalk-20)" }} />
                <AboutYou onDone={() => setEditing(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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

/**
 * What ROUND knows about you so far, in plain words: your ladder, the words
 * you use, how you usually answer, what you never want again. It's the
 * receipt for "it only gets smarter": every night adds a line.
 */
function Learned({ state, byslug }: { state: RoundState; byslug: Record<string, Venue> }) {
  const { profile } = useAuth();
  const ladder = (state.ladder ?? []).filter((x) => !!byslug[x]);
  const nevers = Object.entries(state.been).filter(([, e]) => e.verdict === "never").map(([slug]) => byslug[slug]?.name ?? slug);
  const counts: Record<string, number> = {};
  for (const e of Object.values(state.been)) if (e.verdict === "again" || e.verdict === "back") for (const t of e.tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
  const words = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => ROOM_TAGS.find((t) => t.key === k)?.label ?? k);
  const usual = usualAnswers(state)
    .slice(0, 4)
    .map(([id, label]) => `${(CARDS.find((c) => c.id === id)?.prompt ?? id).replace(/\?$/, "")} → ${label}`);
  const lines: string[] = [];
  if (profile?.name) lines.push(`Your name is ${profile.name.trim().split(/\s+/)[0]}${profile.hometown ? `, from ${profile.hometown}` : ""}.`);
  if (profile?.fav_bar) lines.push(`Your favorite bar is ${profile.fav_bar}${profile.fav_bar_slug ? "; your picks lean that way" : ""}.`);
  if (ladder.length) lines.push(`${ladder.length} ${ladder.length === 1 ? "place" : "places"} on your ladder; ${byslug[ladder[0]]?.name ?? ladder[0]} is your #1.`);
  if (words.length) lines.push(`Rooms you love are ${words.map((w) => w.toLowerCase()).join(", ")}.`);
  if (usual.length) lines.push(`You usually say: ${usual.join("; ")}.`);
  if (nevers.length) lines.push(`Never again: ${nevers.join(", ")}.`);
  const n = lines.length;
  return (
    <section className="mt-6 rounded-[24px] border p-4" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }} data-learned={n}>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">What ROUND knows about you</p>
        <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
          {n === 0 ? "nothing yet" : `${n} ${n === 1 ? "thing" : "things"}`}
        </span>
      </div>
      {n === 0 ? (
        <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
          Answer the quick ones, rate a place, sign in. Every one of those makes the next pick sharper. It only gets smarter.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {lines.map((l) => (
            <li key={l} className="flex gap-2 text-[13.5px] leading-snug">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--tomato)" }} aria-hidden />
              <span>{l}</span>
            </li>
          ))}
          <li className="pl-3.5 text-[12px]" style={{ color: "var(--chalk-35)" }}>
            Every answer and every rating adds a line. It only gets smarter.
          </li>
        </ul>
      )}
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

function RecommendIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path d="M13 22s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" stroke="#16213A" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="13" cy="11" r="2.4" stroke="#D9482B" strokeWidth="1.6" />
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
