"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { Photo } from "@/components/Photo";
import { MapSheet, Legend } from "@/components/MapSheet";
import { SignInFlow } from "@/components/SignInSheet";
import { useRoundStore, usualAnswers, type RoundState } from "@/lib/store";
import { CARDS } from "@/lib/questions";
import { ROOM_TAGS } from "@/components/RateSheet";
import { useAuth } from "@/lib/auth";
import { AboutYou, Avatar } from "@/components/AboutYou";
import { prettyPhone } from "@/lib/phone";
import { venueMap } from "@/lib/venues";
import { neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";

const NightMap = dynamic(() => import("@/components/NightMap").then((m) => m.NightMap), {
  ssr: false,
  loading: () => <div className="rounded-[24px] border" style={{ height: 300, borderColor: "var(--hairline)", background: "var(--paper-2)" }} />,
});

/**
 * YOU. Someone we don't know yet gets one thing: enter your number. Someone
 * we do gets their name up top, their map (tap it and it fills the screen),
 * their taste as ROUND reads it, and everything they've saved, ranked and
 * been to. Every line of it is what makes the next pick sharper.
 */
export function YouView({ venues }: { venues: Venue[] }) {
  const { enabled, ready, user, needsProfile } = useAuth();
  // Signing in right here: the flow stays on screen through the about-you questions, then the page becomes theirs.
  const [flow, setFlow] = useState<"idle" | "started" | "done">("idle");
  const onSignedIn = useCallback(() => setFlow("started"), []);
  const onDone = useCallback(() => setFlow("done"), []);
  if (enabled && !ready) return <main className="screen screen-with-tabs mx-auto w-full max-w-md" />;
  if (enabled && (!user || needsProfile || flow === "started")) return <Stranger finishing={!!user && needsProfile} started={flow === "started"} onSignedIn={onSignedIn} onDone={onDone} />;
  return <Yours venues={venues} />;
}

/* ───────────────────────── someone we don't know ───────────────────────── */

function Stranger({ finishing, started, onSignedIn, onDone }: { finishing: boolean; started: boolean; onSignedIn: () => void; onDone: () => void }) {
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-you-stranger>
      <header className="pt-5 pb-4">
        <p className="eyebrow">Your NYC</p>
        <h1 className="serif mt-1" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {started && !finishing ? "You're in." : finishing || started ? "Almost in." : "Enter your number."}
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
          {started && !finishing ? "A few quick ones so ROUND knows you. Every one is skippable." : finishing || started ? "A first name and your birthday, and your page is yours." : "One text, a code, and ROUND is yours: your map, your ladder, your friends, on any phone. Never marketing texts."}
        </p>
      </header>
      <section className="card p-5" data-you-signin>
        <SignInFlow reason="you" onSignedIn={onSignedIn} onDone={onDone} />
      </section>
      <ul className="mt-6 grid gap-3">
        {[
          ["Your map", "Every place you've been and want to go, on one map you can open and zoom."],
          ["Your ladder", "Rate a place and it takes its spot against the rest. ROUND picks from it."],
          ["Your friends", "Who's on ROUND, what they've been to, their favorite bars."],
          ["It only gets smarter", "Every answer, every rating, every GO teaches ROUND what you like."],
        ].map(([t, s]) => (
          <li key={t} className="flex gap-3">
            <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--tomato)" }} aria-hidden />
            <span>
              <span className="serif block" style={{ fontSize: 20, lineHeight: 1.15 }}>
                {t}
              </span>
              <span className="block text-[13px] leading-snug" style={{ color: "var(--ink-55)" }}>
                {s}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

/* ───────────────────────── someone we know ───────────────────────── */

function Yours({ venues }: { venues: Venue[] }) {
  const { state } = useRoundStore();
  const { enabled, user, profile, signOut } = useAuth();
  const byslug = useMemo(() => venueMap(venues), [venues]);
  const [mapOpen, setMapOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const openMap = useCallback(() => setMapOpen(true), []);

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

  const first = (profile?.name ?? "").trim().split(/\s+/)[0] || "you";
  const favSlug = profile?.fav_bar_slug ?? undefined;
  const subline = [profile?.hometown ? `Lives in ${profile.hometown}` : null, profile?.fav_bar ? `Favorite bar: ${profile.fav_bar}` : null, profile?.fav_restaurant ? `Favorite restaurant: ${profile.fav_restaurant}` : null].filter(Boolean).join(" · ");

  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-you>
      <header className="flex items-center gap-3 pt-5 pb-4">
        <button onClick={() => setEditing(true)} className="pressable shrink-0" aria-label="Edit your photo and about you" data-edit-about>
          <Avatar url={profile?.avatar_url} name={profile?.name} size={56} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Your NYC</p>
          <h1 className="serif mt-0.5 truncate" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-0.02em" }} data-you-name>
            {enabled ? `Hi, ${first}.` : "You"}
          </h1>
          {subline && (
            <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--ink-55)" }} data-about-lines>
              {subline}
            </p>
          )}
        </div>
        <button onClick={() => setEditing(true)} className="pressable btn-ghost h-9 shrink-0 px-3 text-[12.5px]" data-edit-about-btn>
          Edit
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2" data-you-stats>
        <Stat n={been.length} label="been" href="#been" />
        <Stat n={saved.length} label="want to go" href="#want" />
        <Stat n={ladder.length} label="ladder" href="#ladder" tone="tomato" />
      </div>

      {/* The map: a picture here, the whole screen on a tap. */}
      <section className="relative mt-4">
        <div role="button" tabIndex={0} onClick={() => setMapOpen(true)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setMapOpen(true)} className="pressable block w-full cursor-pointer text-left" aria-label="Open your map" data-open-map>
          <NightMap venues={venues} saved={savedSet} been={beenSet} height={300} interactive={false} onSelect={openMap} />
        </div>
        <div className="pointer-events-none absolute left-4 top-4 flex gap-2 text-[11px]" style={{ color: "var(--chalk-70)" }}>
          <Legend color="#d9482b" label="Want to go" ring />
          <Legend color="#16213a" label="Been" />
        </div>
        <button onClick={() => setMapOpen(true)} className="pressable absolute bottom-3 right-3 flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium" style={{ background: "rgba(243,237,224,0.94)", borderColor: "var(--hairline-strong)", backdropFilter: "blur(10px)" }} data-open-map-btn>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M8 2h4v4M6 12H2V8M12 2 8 6M2 12l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Open the map
        </button>
      </section>
      <MapSheet open={mapOpen} onClose={() => setMapOpen(false)} venues={venues} saved={savedSet} been={beenSet} title={`${first}'s NYC`} />

      <Taste state={state} byslug={byslug} beenVenues={been.map((b) => b.venue)} />

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/recommend" className="pressable card flex min-h-[112px] flex-col justify-between p-4">
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-wide" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>
            $2 A SPOT
          </span>
          <div>
            <p className="text-[15px] font-medium">Add a spot</p>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--chalk-55)" }}>
              Tell us about a bar. We check it; you get paid.
            </p>
          </div>
        </Link>
        <Link href="/quiz" className="pressable flex min-h-[112px] flex-col justify-between rounded-[28px] p-4" style={{ background: state.quizDone ? "var(--surface)" : "linear-gradient(160deg, #143327, #2e6b52)", color: state.quizDone ? "var(--ink)" : "var(--on-photo)", border: "1px solid var(--hairline)" }}>
          <QuizIcon dark={!!state.quizDone} />
          <div>
            <p className="text-[15px] font-medium">{state.quizDone ? "Retake the taste quiz" : "30-second taste quiz"}</p>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: state.quizDone ? "var(--ink-55)" : "var(--on-photo-80)" }}>
              Ten bars. Swipe. ROUND learns you.
            </p>
          </div>
        </Link>
      </section>

      <div id="want" className="scroll-mt-4" />
      <Section title="Want to go" count={saved.length} empty="Save a place from Spots or a results page and it lands here.">
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
      <Section title="Your ladder" count={ladder.length} empty="Rate a place you've been and it takes its spot here, best first. ROUND picks from your ladder.">
        <ol className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          {ladder.map(({ venue, entry }, i) => (
            <li key={venue.slug} style={{ borderColor: "var(--hairline)" }}>
              <Link href={`/v/${venue.slug}`} className="pressable flex items-center gap-3 py-3">
                <span className="serif w-7 shrink-0 text-right" style={{ fontSize: 22, color: i === 0 ? "var(--tomato)" : "var(--chalk-35)" }}>
                  {i + 1}
                </span>
                <Photo venue={venue} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                    {venue.name}
                    {favSlug === venue.slug && (
                      <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--tomato)" }}>
                        favorite
                      </span>
                    )}
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

      <div id="been" className="scroll-mt-4" />
      <Section title="Been" count={been.length} empty="Tap I've been on any place. Rate it the morning after and it climbs your ladder.">
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
              <span className="text-[12px] font-medium" style={{ color: entry.verdict || entry.rating ? "var(--chalk)" : "var(--tomato)" }}>
                {entry.verdict === "again" ? "Take me back" : entry.verdict === "back" ? "I'd go back" : entry.verdict === "fine" ? "Fine" : entry.verdict === "never" ? "Never again" : entry.rating === "loved" ? "Loved" : entry.rating === "good" ? "Good" : entry.rating === "meh" ? "Meh" : "Rate it"}
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <section className="card mt-8 p-4" data-account-card>
        <div className="flex items-center gap-3">
          <Avatar url={profile?.avatar_url} name={profile?.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{profile?.name ?? "This phone"}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
              {enabled && user ? `${prettyPhone(user.phone)} · saved to your account` : "Everything here lives on this phone for now."}
            </p>
          </div>
          {enabled && user && (
            <button onClick={() => signOut()} className="pressable text-[12.5px] font-medium" style={{ color: "var(--chalk-55)" }}>
              Sign out
            </button>
          )}
        </div>
      </section>

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
    </main>
  );
}

function Stat({ n, label, href, tone }: { n: number; label: string; href: string; tone?: "tomato" }) {
  return (
    <a href={href} className="pressable card flex flex-col px-3 py-2.5">
      <span className="serif" style={{ fontSize: 28, lineHeight: 1, color: tone === "tomato" && n > 0 ? "var(--tomato)" : "var(--ink)" }}>
        {n}
      </span>
      <span className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-55)" }}>
        {label}
      </span>
    </a>
  );
}

/**
 * Your taste, as ROUND reads it: three meters from the rooms you've been to
 * and rated, the words you use for the ones you love, how you usually answer,
 * and what you never want again. Every night adds to it.
 */
function Taste({ state, byslug, beenVenues }: { state: RoundState; byslug: Record<string, Venue>; beenVenues: Venue[] }) {
  const { profile } = useAuth();
  const loved = beenVenues.filter((v) => ["again", "back"].includes(state.been[v.slug]?.verdict ?? "") || state.been[v.slug]?.rating === "loved");
  const pool = loved.length >= 2 ? loved : beenVenues;
  const meters = pool.length
    ? (["lively", "chill", "talk"] as const).map((k) => ({ k, label: { lively: "Lively", chill: "Chill", talk: "Can talk" }[k], v: pool.reduce((s, v) => s + v.attrs[k], 0) / pool.length }))
    : null;
  const lean = meters ? meters.slice().sort((a, b) => b.v - a.v)[0] : null;
  const counts: Record<string, number> = {};
  for (const e of Object.values(state.been)) if (e.verdict === "again" || e.verdict === "back") for (const t of e.tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
  const words = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => ROOM_TAGS.find((t) => t.key === k)?.label ?? k);
  const usual = usualAnswers(state)
    .slice(0, 4)
    .map(([id, label]) => ({ q: (CARDS.find((c) => c.id === id)?.prompt ?? id).replace(/\?$/, ""), a: label }));
  const nevers = Object.entries(state.been)
    .filter(([, e]) => e.verdict === "never")
    .map(([slug]) => byslug[slug]?.name ?? slug);
  const went = Object.entries(state.goCount ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => byslug[slug]?.name)
    .filter(Boolean) as string[];
  const ladder = (state.ladder ?? []).filter((x) => !!byslug[x]);

  // The receipt, in plain words (tests and the picker read the same facts).
  const lines: string[] = [];
  if (profile?.name) lines.push(`Your name is ${profile.name.trim().split(/\s+/)[0]}${profile.hometown ? `; you live in ${profile.hometown}` : ""}.`);
  if (profile?.fav_bar) lines.push(`Your favorite bar is ${profile.fav_bar}${profile.fav_bar_slug ? "; your picks lean that way" : ""}.`);
  if (ladder.length) lines.push(`${byslug[ladder[0]]?.name ?? ladder[0]} is your #1.`);
  if (went.length) lines.push(`You've tapped GO at ${went.join(", ")}.`);
  const n = lines.length + (meters ? 1 : 0) + (words.length ? 1 : 0) + (usual.length ? 1 : 0) + (nevers.length ? 1 : 0);

  return (
    <section className="card mt-4 p-4" data-learned={n} data-taste>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Your taste, as ROUND reads it</p>
        <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
          {n === 0 ? "nothing yet" : `${n} ${n === 1 ? "thing" : "things"}`}
        </span>
      </div>

      {meters ? (
        <div className="mt-3">
          <p className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>
            {lean?.k === "lively" ? "You lean lively." : lean?.k === "chill" ? "You lean chill." : "You lean toward rooms you can talk in."}
          </p>
          <div className="mt-3 grid gap-2">
            {meters.map((m) => (
              <div key={m.k} className="flex items-center gap-3 text-[12px]">
                <span className="w-16 shrink-0" style={{ color: "var(--ink-55)" }}>
                  {m.label}
                </span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(22,33,58,0.08)" }}>
                  <motion.span initial={{ width: 0 }} animate={{ width: `${Math.round(m.v * 100)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="absolute inset-y-0 left-0 rounded-full" style={{ background: m.k === lean?.k ? "var(--tomato)" : "var(--ink-35)" }} />
                </span>
                <span className="w-8 text-right tabular-nums" style={{ color: "var(--ink-35)" }}>
                  {Math.round(m.v * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
          Tap I&apos;ve been on a couple of places and rate them, and your taste shows up here as three meters. Until then ROUND goes on what you answer.
        </p>
      )}

      {words.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-35)" }}>
            Rooms you love
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {words.map((w) => (
              <span key={w} className="rounded-full px-2.5 py-1 text-[12.5px] font-medium" style={{ background: "var(--ink)", color: "var(--paper)" }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {usual.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-35)" }}>
            You usually say
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {usual.map((u) => (
              <span key={u.q} className="rounded-full border px-2.5 py-1 text-[12.5px]" style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }}>
                <span style={{ color: "var(--ink-35)" }}>{u.q} · </span>
                <span className="font-medium" style={{ color: "var(--ink)" }}>
                  {u.a}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(lines.length > 0 || nevers.length > 0) && (
        <ul className="mt-4 grid gap-1.5 border-t pt-3" style={{ borderColor: "var(--hairline)" }} data-learned-lines>
          {lines.map((l) => (
            <li key={l} className="flex gap-2 text-[13px] leading-snug">
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--tomato)" }} aria-hidden />
              <span>{l}</span>
            </li>
          ))}
          {nevers.length > 0 && (
            <li className="flex gap-2 text-[13px] leading-snug" style={{ color: "var(--ink-55)" }}>
              <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--ink-35)" }} aria-hidden />
              <span>Never again: {nevers.join(", ")}.</span>
            </li>
          )}
        </ul>
      )}
      <p className="mt-3 text-[11.5px]" style={{ color: "var(--chalk-35)" }}>
        Every answer, every rating, every GO adds to this. It only gets smarter.
      </p>
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

function QuizIcon({ dark }: { dark: boolean }) {
  const c = dark ? "#16213A" : "#F6F1E7";
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect x="6" y="4" width="14" height="18" rx="3.5" stroke={c} strokeWidth="1.6" transform="rotate(-8 13 13)" />
      <rect x="9" y="6" width="14" height="18" rx="3.5" stroke={c} strokeWidth="1.6" opacity="0.5" transform="rotate(6 16 15)" />
    </svg>
  );
}
