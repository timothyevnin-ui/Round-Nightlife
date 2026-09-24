"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { SignInFlow } from "@/components/SignInSheet";
import { HomeScreenCard } from "@/components/HomeScreenCard";
import { useRoundStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AboutYou, Avatar } from "@/components/AboutYou";
import { prettyPhone } from "@/lib/phone";
import { venueMap } from "@/lib/venues";
import { beenRows, memberSince, rungs, scoreText, scoreTone } from "@/lib/ladder";
import { personById, type Person } from "@/lib/friends";
import { Pitch, PrivacyCard, type Place, type Regular } from "@/app/friends/FriendsView";
import { Faces, FinderSheet, PeopleSheet, PersonSheet, RequestsCard, Sheet, useCircle, type CircleApi } from "./Circle";
import type { Venue } from "@/lib/types";

/**
 * YOU (V27). Someone we don't know gets the pitch, typed out, with the number
 * box right on it. Someone we do gets a profile: their face in the middle,
 * their name, when they joined; Followers · Following · Rank; Edit and Share;
 * then the $2 door, right up top, because it's how ROUND spreads; then the
 * lists, each its own page: Been (with the numbers), Want to try, your ladder,
 * your favorites; the quiz; Add ROUND to your Home Screen; who sees you; the
 * account.
 */
export function YouView({ venues, places }: { venues: Venue[]; regulars?: Regular[]; places: Record<string, Place> }) {
  const { enabled, ready, user, needsProfile } = useAuth();
  // Signing in right here: the flow stays on screen through the about-you questions, then the page becomes theirs.
  const [flow, setFlow] = useState<"idle" | "started" | "done">("idle");
  const onSignedIn = useCallback(() => setFlow("started"), []);
  const onDone = useCallback(() => setFlow("done"), []);
  if (enabled && !ready) return <main className="screen screen-with-tabs mx-auto w-full max-w-md" />;
  if (enabled && (!user || needsProfile || flow === "started")) return <Stranger finishing={!!user && needsProfile} started={flow === "started"} onSignedIn={onSignedIn} onDone={onDone} />;
  return <Yours venues={venues} places={places} />;
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
          {started && !finishing ? "A few quick ones so ROUND knows you. Every one is skippable." : finishing || started ? "A first name and your birthday, and the page is yours." : "One text, a code, and ROUND is yours on any phone: your people, your spots, your ladder."}
        </p>
        <div className="mt-3">
          <SignInFlow reason="you" onSignedIn={onSignedIn} onDone={onDone} bare />
        </div>
      </Pitch>
    </div>
  );
}

/* ───────────────────────── someone we know ───────────────────────── */

/** The link that follows you: open it signed in and the person's sheet is up, with Follow on it. */
export function profileLink(id: string): string {
  const base = typeof window !== "undefined" && /roundnyc\.com|vercel\.app/.test(window.location.host) ? window.location.origin : "https://roundnyc.com";
  return `${base}/you?follow=${id}`;
}

function Yours({ venues, places }: { venues: Venue[]; places: Record<string, Place> }) {
  const { state } = useRoundStore();
  const { enabled, user, profile, signOut } = useAuth();
  const byslug = useMemo(() => venueMap(venues), [venues]);
  const [editing, setEditing] = useState(false);
  const [people, setPeople] = useState<"following" | "followers" | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [finding, setFinding] = useState(false);
  const [peek, setPeek] = useState<Person | null>(null);
  const [shared, setShared] = useState<"copied" | null>(null);
  const circle = useCircle(enabled && user ? user.id : undefined);
  const openPerson = useCallback((p: Person) => setPeek(p), []);

  // A shared link (?follow=…): the person is up as soon as the page is, with Follow on their sheet.
  const sb = circle.sb;
  useEffect(() => {
    if (!sb || !user) return;
    const id = new URLSearchParams(window.location.search).get("follow");
    if (!id || id === user.id) return;
    let live = true;
    void personById(sb, id).then((p) => {
      if (live && p) setPeek(p);
    });
    return () => {
      live = false;
    };
  }, [sb, user]);

  const saved = Object.entries(state.saved)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([slug]) => byslug[slug])
    .filter((v): v is Venue => !!v);
  const been = beenRows(state, byslug);
  const ladder = rungs(state, byslug);

  const name = (profile?.name ?? "").trim() || "You";
  const since = memberSince(profile?.created_at);
  const favSlug = profile?.fav_bar_slug ?? undefined;
  const favBar = favSlug ? byslug[favSlug] : undefined;
  const favRestaurant = profile?.fav_restaurant ? venues.find((v) => v.name.toLowerCase() === profile.fav_restaurant!.toLowerCase()) : undefined;

  // Rank: among the people you follow (and you), by places been. Nobody followed yet: no rank.
  const board: { person: Person; been: number; me: boolean }[] = [];
  if (user) {
    board.push({ person: { id: user.id, name, is_public: true, avatar_url: profile?.avatar_url } as Person, been: Object.keys(state.been).length, me: true });
    for (const p of circle.circle.following) board.push({ person: p, been: circle.spotsOf(p.id).filter((s) => s.state === "been").length, me: false });
    board.sort((a, b) => b.been - a.been || (a.me ? -1 : 1));
  }
  const rank = circle.circle.following.length ? board.findIndex((r) => r.me) + 1 : null;

  const share = async () => {
    if (!user) return;
    const url = profileLink(user.id);
    const text = `Follow me on ROUND, it picks the bar. ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "ROUND", text, url });
        return;
      }
    } catch {
      /* dismissed: fall through to the clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
      setShared("copied");
      window.setTimeout(() => setShared(null), 1800);
    } catch {
      /* nothing to do */
    }
  };

  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md" data-you>
      {/* The top bar: the name on the left, share and the menu on the right. */}
      <header className="flex items-center justify-between gap-3 pt-4 pb-1" data-you-top>
        <h1 className="serif truncate" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.015em" }} data-you-name>
          {name}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          {enabled && user && (
            <button onClick={() => void share()} className="pressable flex h-10 w-10 items-center justify-center rounded-full" aria-label="Share your profile" data-share-profile>
              <ShareIcon />
            </button>
          )}
          <button onClick={() => setMenu(true)} className="pressable flex h-10 w-10 items-center justify-center rounded-full" aria-label="More" data-you-menu>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="4" cy="10" r="1.7" fill="currentColor" />
              <circle cx="10" cy="10" r="1.7" fill="currentColor" />
              <circle cx="16" cy="10" r="1.7" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      {/* The profile: face in the middle, name, since when. */}
      <section className="flex flex-col items-center pt-3 text-center" data-you-hero>
        <button onClick={() => setEditing(true)} className="pressable relative shrink-0 rounded-full" aria-label="Edit your photo and about you" data-edit-about>
          <Avatar url={profile?.avatar_url} name={profile?.name} size={96} />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--ink)", color: "var(--paper)", boxShadow: "0 0 0 2px var(--paper)" }} aria-hidden>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 10.5V12h1.5l7-7L9 3.5l-7 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <p className="serif mt-3" style={{ fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }} data-you-fullname>
          {name}
        </p>
        {since && (
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-55)" }} data-member-since>
            Member since {since}
          </p>
        )}
        {profile?.hometown ? (
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-55)" }} data-about-lines>
            Lives in {profile.hometown}
            {profile.fav_bar ? ` · ${profile.fav_bar} regular` : ""}
          </p>
        ) : (
          <button onClick={() => setEditing(true)} className="pressable mt-1 text-[12.5px] font-medium" style={{ color: "var(--tomato)" }} data-add-about>
            + Add where you live
          </button>
        )}

        {/* Followers · Following · Rank */}
        {enabled && user && (
          <div className="mt-4 grid w-full grid-cols-3" data-circle data-following={circle.circle.following.length} data-followers={circle.circle.followers.length} data-rank={rank ?? ""}>
            <Stat n={circle.circle.followers.length} label="Followers" onClick={() => setPeople("followers")} testId="data-open-followers" faces={circle.circle.followers} />
            <Stat n={circle.circle.following.length} label="Following" onClick={() => setPeople("following")} testId="data-open-following" faces={circle.circle.following} divider />
            <Stat n={rank ? `#${rank}` : "—"} label="Rank" onClick={() => setRankOpen(true)} testId="data-open-rank" divider />
          </div>
        )}

        <div className="mt-4 flex w-full items-center gap-2">
          <button onClick={() => setEditing(true)} className="pressable btn-ghost flex h-11 flex-1 items-center justify-center text-[14px] font-medium" data-edit-about-btn>
            Edit profile
          </button>
          {enabled && user && (
            <>
              <button onClick={() => void share()} className="pressable btn-ghost flex h-11 flex-1 items-center justify-center text-[14px] font-medium" data-share-profile-btn>
                {shared === "copied" ? "Link copied" : "Share profile"}
              </button>
              <button onClick={() => setFinding(true)} className="pressable btn-primary flex h-11 shrink-0 items-center px-4 text-[14px]" data-find-toggle aria-label="Find friends">
                + Find
              </button>
            </>
          )}
        </div>
      </section>

      {enabled && user && circle.problem && (
        <p className="card mt-3 p-4 text-[13.5px]" style={{ color: "var(--tomato-deep)" }}>
          {circle.problem}
        </p>
      )}
      {enabled && user && <RequestsCard api={circle} />}
      {enabled && user && circle.note && !finding && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-55)" }} data-circle-note>
          {circle.note}
        </p>
      )}

      {/* The $2 door, right up top: it's how ROUND spreads. */}
      <Link href="/recommend" className="pressable grain relative mt-5 flex items-center gap-4 overflow-hidden rounded-[26px] p-4" style={{ background: "linear-gradient(160deg, #8f2a15 0%, #d9482b 60%, #e8694a 100%)", color: "var(--on-photo)", boxShadow: "0 16px 36px -22px rgba(217,72,43,0.7)" }} data-recommend-card>
        <span className="serif flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px]" style={{ background: "rgba(246,241,231,0.16)", fontSize: 26, backdropFilter: "blur(6px)" }} aria-hidden>
          $2
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--on-photo-80)" }}>
            Get paid for a spot
          </span>
          <span className="serif mt-0.5 block" style={{ fontSize: 22, lineHeight: 1.05 }}>
            Recommend a bar we don&apos;t have.
          </span>
          <span className="mt-1 block text-[12.5px] leading-snug" style={{ color: "var(--on-photo-80)" }}>
            Two minutes. We check it; you get $2. Every time.
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(246,241,231,0.16)" }} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" stroke="#F6F1E7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>

      {/* The lists, each its own page. */}
      <section className="card mt-4 overflow-hidden" data-you-lists>
        <Row href="/you/been" icon={<CheckIcon />} label="Been" count={been.length} sub={been.length ? topLine(been) : "Every place you've been, with your number on it."} testId="been" />
        <Row href="/you/want" icon={<BookmarkIcon />} label="Want to try" count={saved.length} sub={saved.length ? saved.slice(0, 3).map((v) => v.name).join(" · ") : "Save a place and it lands here."} testId="want" />
        <Row href="/you/ladder" icon={<LadderIcon />} label="Your ladder" count={ladder.length} sub={ladder.length ? `${ladder[0].venue.name} is your #1` : "Rate a place and it takes its rung. ROUND picks from it."} testId="ladder" />
        <Row onClick={() => setEditing(true)} icon={<StarIcon />} label="Favorites" sub={favBar || profile?.fav_bar || favRestaurant || profile?.fav_restaurant ? [profile?.fav_bar, profile?.fav_restaurant].filter(Boolean).join(" · ") : "Your favorite bar and restaurant."} testId="favorites" last />
      </section>

      {/* The quiz */}
      <Link href="/quiz" className="pressable mt-4 flex items-center gap-4 rounded-[26px] p-4" style={{ background: state.quizDone ? "var(--surface)" : "linear-gradient(160deg, #143327, #2e6b52)", color: state.quizDone ? "var(--ink)" : "var(--on-photo)", border: "1px solid var(--hairline)" }} data-quiz-card>
        <QuizIcon dark={!!state.quizDone} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">{state.quizDone ? "Retake the taste quiz" : "30-second taste quiz"}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: state.quizDone ? "var(--ink-55)" : "var(--on-photo-80)" }}>
            Ten bars. Swipe. ROUND learns you.
          </span>
        </span>
        <Chevron color={state.quizDone ? "var(--ink-35)" : "var(--on-photo-60)"} />
      </Link>

      <HomeScreenCard />

      {enabled && user && <PrivacyCard />}

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

      {enabled && user && (
        <>
          <PeopleSheet api={circle} which={people} onClose={() => setPeople(null)} onOpen={openPerson} />
          <FinderSheet api={circle} me={user.id} open={finding} onClose={() => setFinding(false)} onOpen={openPerson} />
          <PersonSheet api={circle} person={peek} places={places} onClose={() => setPeek(null)} />
          <RankSheet open={rankOpen} onClose={() => setRankOpen(false)} board={board} api={circle} onOpen={openPerson} onFind={() => { setRankOpen(false); setFinding(true); }} />
        </>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} label="More" testId="data-you-menu-sheet">
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          <button onClick={() => { setMenu(false); setEditing(true); }} className="pressable py-3.5 text-left text-[15px] font-medium">
            Edit profile
          </button>
          {enabled && user && (
            <button onClick={() => { setMenu(false); void share(); }} className="pressable py-3.5 text-left text-[15px] font-medium">
              Share your profile
            </button>
          )}
          <Link href="/recommend" onClick={() => setMenu(false)} className="pressable py-3.5 text-[15px] font-medium">
            Recommend a spot ($2)
          </Link>
          {enabled && user && (
            <button onClick={() => { setMenu(false); void signOut(); }} className="pressable py-3.5 text-left text-[15px] font-medium" style={{ color: "var(--tomato-deep)" }}>
              Sign out
            </button>
          )}
        </div>
        <button onClick={() => setMenu(false)} className="pressable btn-primary mt-4 flex h-11 w-full items-center justify-center text-[14px]">
          Done
        </button>
      </Sheet>

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

/** "Wogies 10 · White Horse 9.2 · …": the top of the ladder in one line. */
function topLine(rows: ReturnType<typeof beenRows>): string {
  return rows
    .slice(0, 3)
    .map((r) => (r.score > 0 ? `${r.venue.name} ${scoreText(r.score)}` : r.venue.name))
    .join(" · ");
}

/** One number over one word; tap for the list. */
function Stat({ n, label, onClick, testId, faces, divider }: { n: number | string; label: string; onClick: () => void; testId: string; faces?: Person[]; divider?: boolean }) {
  return (
    <button onClick={onClick} className="pressable flex flex-col items-center py-1" style={divider ? { borderLeft: "1px solid var(--hairline)" } : undefined} {...{ [testId]: "1" }}>
      <span className="serif" style={{ fontSize: 26, lineHeight: 1 }}>
        {n}
      </span>
      <span className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-55)" }}>
        {label}
      </span>
      {faces && faces.length > 0 && (
        <span className="mt-1.5">
          <Faces people={faces} max={3} />
        </span>
      )}
    </button>
  );
}

/** A row in the lists card: an icon, the word, the count, the chevron. */
function Row({ href, onClick, icon, label, count, sub, testId, last }: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; count?: number; sub?: string; testId: string; last?: boolean }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--ink-6)", color: "var(--ink)" }} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="serif" style={{ fontSize: 21, lineHeight: 1.1 }}>
            {label}
          </span>
          {typeof count === "number" && (
            <span className="text-[13px] font-medium" style={{ color: "var(--ink-35)" }} data-row-count>
              {count}
            </span>
          )}
        </span>
        {sub && (
          <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--ink-55)" }}>
            {sub}
          </span>
        )}
      </span>
      <Chevron color="var(--ink-35)" />
    </>
  );
  const cls = `pressable flex w-full items-center gap-3 px-4 py-3.5 text-left ${last ? "" : "border-b"}`;
  const style = { borderColor: "var(--hairline)" };
  return href ? (
    <Link href={href} className={cls} style={style} data-you-row={testId}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls} style={style} data-you-row={testId}>
      {inner}
    </button>
  );
}

/** Rank: you and the people you follow, by places been. */
function RankSheet({ open, onClose, board, api, onOpen, onFind }: { open: boolean; onClose: () => void; board: { person: Person; been: number; me: boolean }[]; api: CircleApi; onOpen: (p: Person) => void; onFind: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Rank" testId="data-rank-sheet">
      <h2 className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
        Rank
      </h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--ink-55)" }}>
        You and the people you follow, by places been.
      </p>
      {api.circle.following.length ? (
        <ol className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          {board.map((r, i) => (
            <li key={r.person.id} className="flex items-center gap-3 py-3" style={{ borderColor: "var(--hairline)", background: r.me ? "transparent" : undefined }} data-rank-row={r.me ? "me" : r.person.id}>
              <span className="serif w-7 shrink-0 text-right" style={{ fontSize: 22, color: i === 0 ? "var(--tomato)" : "var(--ink-35)" }}>
                {i + 1}
              </span>
              {r.me ? (
                <Avatar url={r.person.avatar_url} name={r.person.name} size={36} />
              ) : (
                <button onClick={() => onOpen(r.person)} className="pressable rounded-full" aria-label={r.person.name}>
                  <Avatar url={r.person.avatar_url} name={r.person.name} size={36} />
                </button>
              )}
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{r.me ? "You" : r.person.name}</span>
              <span className="text-[13px]" style={{ color: "var(--ink-55)" }}>
                {r.been} been
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4">
          <p className="text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            Follow a few friends and you&apos;ll see who&apos;s been out the most.
          </p>
          <button onClick={onFind} className="pressable btn-primary mt-3 flex h-11 items-center px-5 text-[14px]">
            Find friends
          </button>
        </div>
      )}
      <button onClick={onClose} className="pressable btn-ghost mt-5 flex h-11 w-full items-center justify-center text-[14px]">
        Done
      </button>
    </Sheet>
  );
}

/* ── icons ── */

function Chevron({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0" style={{ color }}>
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10v5.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="m5.8 9.2 2.2 2.2 4.2-4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M4.5 2.5h9v13l-4.5-3-4.5 3v-13Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function LadderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M5 2v14M13 2v14M5 5.5h8M5 9h8M5 12.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="m9 2.5 2 4.1 4.5.6-3.3 3.2.8 4.5L9 12.8l-4 2.1.8-4.5L2.5 7.2 7 6.6 9 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function QuizIcon({ dark }: { dark: boolean }) {
  const c = dark ? "#16213A" : "#F6F1E7";
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden className="shrink-0">
      <rect x="6" y="4" width="14" height="18" rx="3.5" stroke={c} strokeWidth="1.6" transform="rotate(-8 13 13)" />
      <rect x="9" y="6" width="14" height="18" rx="3.5" stroke={c} strokeWidth="1.6" opacity="0.5" transform="rotate(6 16 15)" />
    </svg>
  );
}

/** A place's score chip, for the lists. */
export function ScoreChip({ score, big }: { score: number; big?: boolean }) {
  return (
    <span className="serif flex shrink-0 items-center justify-center rounded-full" style={{ width: big ? 46 : 40, height: big ? 46 : 40, fontSize: big ? 18 : 15, background: score >= 9 ? "var(--tomato)" : score >= 7 ? "var(--pine)" : "var(--ink-6)", color: score >= 7 ? "var(--on-photo)" : scoreTone(score) }} data-score={score > 0 ? score.toFixed(1) : ""}>
      {scoreText(score)}
    </span>
  );
}
