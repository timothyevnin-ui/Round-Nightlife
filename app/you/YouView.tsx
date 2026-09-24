"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Photo } from "@/components/Photo";
import { SignInFlow } from "@/components/SignInSheet";
import { useRoundStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AboutYou, Avatar } from "@/components/AboutYou";
import { prettyPhone } from "@/lib/phone";
import { venueMap } from "@/lib/venues";
import { neighborhoodName } from "@/lib/neighborhoods";
import { CircleView, Pitch, PrivacyCard, type Place, type Regular } from "@/app/friends/FriendsView";
import type { Venue } from "@/lib/types";

/**
 * YOU (V25: Friends live here too). Someone we don't know yet gets the
 * pitch, typed out, with the number box right on it; no way past it. Someone
 * we do gets their name up top, three numbers, their friends (faces, the
 * feed, the finder), everything they've saved, ranked and been to, the two
 * doors (add a spot, the quiz), who sees them, and their account. The map
 * lives on the Map tab now; there's one.
 */
export function YouView({ venues, regulars, places }: { venues: Venue[]; regulars: Regular[]; places: Record<string, Place> }) {
  const { enabled, ready, user, needsProfile } = useAuth();
  // Signing in right here: the flow stays on screen through the about-you questions, then the page becomes theirs.
  const [flow, setFlow] = useState<"idle" | "started" | "done">("idle");
  const onSignedIn = useCallback(() => setFlow("started"), []);
  const onDone = useCallback(() => setFlow("done"), []);
  if (enabled && !ready) return <main className="screen screen-with-tabs mx-auto w-full max-w-md" />;
  if (enabled && (!user || needsProfile || flow === "started")) return <Stranger finishing={!!user && needsProfile} started={flow === "started"} onSignedIn={onSignedIn} onDone={onDone} />;
  return <Yours venues={venues} regulars={regulars} places={places} />;
}

/* ───────────────────────── someone we don't know ───────────────────────── */

function Stranger({ finishing, started, onSignedIn, onDone }: { finishing: boolean; started: boolean; onSignedIn: () => void; onDone: () => void }) {
  return (
    <div data-you-stranger>
      <Pitch eyebrow="You">
        <p className="eyebrow" style={{ color: "var(--tomato)" }}>
          {started && !finishing ? "You're in" : finishing || started ? "Almost in" : "Enter your number"}
        </p>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--ink-55)" }}>
          {started && !finishing ? "A few quick ones so ROUND knows you. Every one is skippable." : finishing || started ? "A first name and your birthday, and the page is yours." : "One text, a code, and ROUND is yours on any phone: your friends, your saves, your ladder."}
        </p>
        <div className="mt-3">
          <SignInFlow reason="you" onSignedIn={onSignedIn} onDone={onDone} bare />
        </div>
      </Pitch>
    </div>
  );
}

/* ───────────────────────── someone we know ───────────────────────── */

function Yours({ venues, regulars, places }: { venues: Venue[]; regulars: Regular[]; places: Record<string, Place> }) {
  const { state } = useRoundStore();
  const { enabled, user, profile, signOut } = useAuth();
  const byslug = useMemo(() => venueMap(venues), [venues]);
  const [editing, setEditing] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const onCount = useCallback((n: number) => setFriendCount(n), []);

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
        <Stat n={friendCount} label="friends" href="#friends" tone="tomato" />
      </div>

      <div id="friends" className="scroll-mt-4" />
      {enabled && user ? (
        <CircleView me={user.id} places={places} regulars={regulars} embedded onCount={onCount} />
      ) : null}

      <div id="want" className="scroll-mt-4" />
      <Section title="Want to go" count={saved.length} empty="Save a place from the map or a results page and it lands here.">
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

      <section className="mt-8 grid grid-cols-2 gap-3" data-you-doors>
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

      <PrivacyCard />

      <section className="card mt-4 p-4" data-account-card>
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
