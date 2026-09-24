"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { Photo } from "@/components/Photo";
import { useTypewriter } from "@/components/QuickOnes";
import { useAuth } from "@/lib/auth";
import { setPrivacy, type FriendSpot, type Person } from "@/lib/friends";
import { Avatar } from "@/components/AboutYou";
import { getSupabase } from "@/lib/supabase";
import type { NeighborhoodId, Venue } from "@/lib/types";

export type Regular = { slug: string; name: string; neighborhood: NeighborhoodId; tags: string[]; photo: Venue["photo"]; photoUrl?: string; regulars: number };
/** What a friend's spot needs to render: name, neighborhood, art. */
export type Place = { slug: string; name: string; neighborhood: NeighborhoodId; photo: Venue["photo"]; photoUrl?: string };

/**
 * The pieces of "friends" that the YOU tab is built from (V25/V26): the pitch
 * for someone we don't know, a person up close, the list rows, and the
 * privacy card. The circle itself (following, followers, requests, the
 * finder) lives in app/you/Circle.tsx.
 */

/* ───────────────────────── the pitch ───────────────────────── */

const SELL = [
  {
    key: "here",
    t: "See who's already here.",
    s: "Your contacts on ROUND become your friends. Nobody's number is ever shown to anyone.",
    icon: (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
        <circle cx="12" cy="17" r="8.5" stroke="var(--tomato)" strokeWidth="2.4" />
        <circle cx="22" cy="17" r="8.5" stroke="var(--on-photo)" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    key: "ladder",
    t: "It only gets smarter.",
    s: "Every answer, every rating, every never-again teaches ROUND what you like. Rank your spots; your ladder shapes every pick.",
    icon: <Ladder />,
  },
  {
    key: "drink",
    t: "A drink on us at your favorite bar.",
    s: "Add your number now and you're first in line when it opens.",
    icon: (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
        <path d="M8 6h18l-9 12z" stroke="var(--on-photo)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M17 18v8M11 27h12" stroke="var(--on-photo)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M11.5 10.5h11" stroke="var(--tomato)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "picks",
    t: "Coming: your friends' picks. And your favorite micro-celebrities' spots.",
    s: "Where the group actually went last Saturday, and where the people you follow actually drink.",
    icon: (
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
        <path d="M17 4l3.2 8.3L29 15.5l-8.8 3.2L17 27l-3.2-8.3L5 15.5l8.8-3.2z" stroke="var(--tomato)" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/** Three bars, one climbing with the check on it. */
function Ladder() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect x="6" y="6" width="22" height="5" rx="2.5" fill="rgba(246,241,231,0.22)" />
      <rect x="6" y="23" width="22" height="5" rx="2.5" fill="rgba(246,241,231,0.22)" />
      <motion.g initial={{ y: 8.5 }} animate={{ y: [8.5, 8.5, -8.5, -8.5, 8.5] }} transition={{ duration: 4.2, times: [0, 0.35, 0.55, 0.85, 1], repeat: Infinity, ease: "easeInOut" }}>
        <rect x="6" y="14.5" width="22" height="5" rx="2.5" fill="var(--tomato)" />
        <circle cx="24.5" cy="17" r="3.2" fill="var(--paper)" />
        <path d="M22.9 17l1.1 1.1 2-2.1" stroke="var(--tomato)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  );
}

export function Pitch({ onAdd, onLater, eyebrow = "Friends", children }: { onAdd?: () => void; onLater?: () => void; eyebrow?: string; /** The sign-in itself, right here on the page (the YOU tab), instead of a button that opens it. */ children?: React.ReactNode }) {
  const first = "Put your number in.";
  const second = "We'll connect you with your friends.";
  const t1 = useTypewriter(first, 34);
  const done1 = t1.length >= first.length;
  return (
    <main
      className="screen screen-with-tabs relative mx-auto flex w-full max-w-md flex-col overflow-hidden"
      style={{ minHeight: "100dvh", background: "var(--ink)", color: "var(--on-photo)", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", maxWidth: "100vw" }}
      data-pitch
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 45% at 50% -8%, rgba(217,72,43,0.55), transparent 70%), radial-gradient(60% 40% at 100% 110%, rgba(31,74,60,0.6), transparent 70%)" }} />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <header className="flex items-center gap-2.5 pt-5">
          <motion.span aria-hidden className="block h-[18px] w-[18px] rounded-full" style={{ border: "2.5px solid var(--tomato)" }} animate={{ scale: [1, 1.18, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
          <p className="eyebrow" style={{ color: "var(--on-photo-60)" }}>
            {eyebrow}
          </p>
        </header>
        <section className="flex flex-1 flex-col pt-5">
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.02, letterSpacing: "-0.02em", minHeight: "1.1em", color: "var(--paper)" }} aria-label={first}>
            {t1}
            <span aria-hidden className="inline-block align-baseline" style={{ width: 3, height: "0.85em", marginLeft: 3, background: done1 ? "transparent" : "var(--tomato)", transform: "translateY(0.1em)" }} />
          </h1>
          {done1 && <SecondLine text={second} />}
          <motion.ul initial="hidden" animate={done1 ? "show" : "hidden"} variants={{ show: { transition: { staggerChildren: 0.16, delayChildren: 1.0 } } }} className="mt-5 flex flex-col gap-2">
            {SELL.map((b) => (
              <motion.li
                key={b.key}
                variants={{ hidden: { opacity: 0, y: 18, rotate: -1.2 }, show: { opacity: 1, y: 0, rotate: 0 } }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="flex items-center gap-3.5 rounded-[20px] px-3.5 py-2.5"
                style={{ background: "rgba(246,241,231,0.07)", border: "1px solid rgba(246,241,231,0.12)", backdropFilter: "blur(6px)" }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: "rgba(22,33,58,0.55)", border: "1px solid rgba(246,241,231,0.1)" }}>
                  {b.icon}
                </span>
                <span className="min-w-0">
                  <span className="serif block" style={{ fontSize: 19, lineHeight: 1.1, letterSpacing: "-0.01em", color: "var(--paper)" }}>
                    {b.t}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--on-photo-60)" }}>
                    {b.s}
                  </span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={done1 ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 2.0, type: "spring", stiffness: 220, damping: 26 }}
            className="mt-auto pt-5"
          >
            {children ? (
              <div className="card p-5" style={{ background: "var(--surface)", color: "var(--ink)" }} data-you-signin>
                {children}
              </div>
            ) : (
            <motion.button
              onClick={onAdd}
              className="pressable flex h-14 w-full items-center justify-center rounded-full text-[17px] font-semibold"
              style={{ background: "var(--tomato)", color: "var(--on-photo)", boxShadow: "0 0 0 1px rgba(246,241,231,0.08), 0 18px 48px -12px rgba(217,72,43,0.75)" }}
              animate={{ boxShadow: ["0 18px 48px -12px rgba(217,72,43,0.75)", "0 18px 64px -8px rgba(217,72,43,0.95)", "0 18px 48px -12px rgba(217,72,43,0.75)"] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              Add my number
            </motion.button>
            )}
            {onLater && (
              <button onClick={onLater} className="pressable mx-auto mt-2.5 block text-[13.5px] font-medium" style={{ color: "var(--on-photo-60)" }}>
                Maybe later
              </button>
            )}
            <p className="mt-2.5 text-center text-[11.5px] leading-relaxed" style={{ color: "rgba(246,241,231,0.42)" }}>
              One text with a code. Never marketing texts. 21+ only.
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function SecondLine({ text }: { text: string }) {
  const typed = useTypewriter(text, 34);
  return (
    <h2 className="serif mt-2" style={{ fontSize: 24, lineHeight: 1.1, letterSpacing: "-0.015em", color: "var(--on-photo-80)", minHeight: "1.2em" }} aria-label={text}>
      {typed}
      <span aria-hidden className="inline-block align-baseline" style={{ width: 3, height: "0.8em", marginLeft: 3, background: typed.length >= text.length ? "transparent" : "var(--tomato)", transform: "translateY(0.1em)" }} />
    </h2>
  );
}


/* ───────────────────────── people ───────────────────────── */

/** A friend, up close: their ladder, everything they've been to, what they want to go to. */
export function FriendSheet({ person, spots, places, onClose, relation, onFollow, onUnfollow }: { person: Person | null; spots: FriendSpot[]; places: Record<string, Place>; onClose: () => void; /** V26: how you stand with them. */ relation?: "following" | "requested" | "none"; onFollow?: () => void; onUnfollow?: () => void }) {
  if (typeof document === "undefined") return null;
  const ladder = spots.filter((s) => s.state === "been" && s.rank).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const been = spots.filter((s) => s.state === "been" && !s.rank);
  const want = spots.filter((s) => s.state === "want");
  return createPortal(
    <AnimatePresence>
      {person && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={onClose} role="dialog" aria-modal data-friend-sheet>
          <motion.div initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }} onClick={(e) => e.stopPropagation()} className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--chalk-20)" }} />
            <div className="flex items-center gap-3">
              <Avatar url={person.avatar_url} name={person.name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="serif truncate" style={{ fontSize: 28, lineHeight: 1.05 }}>
                  {person.name}
                </p>
                <p className="truncate text-[12.5px]" style={{ color: "var(--ink-55)" }}>
                  {[person.hometown ? `Lives in ${person.hometown}` : null, person.fav_bar ? `${person.fav_bar} regular` : null].filter(Boolean).join(" · ") || "On ROUND"}
                </p>
                {relation === "following" && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--pine)" }}>
                    Following
                  </p>
                )}
              </div>
            </div>
            {person.fav_bar_slug && places[person.fav_bar_slug] && (
              <Link href={`/v/${person.fav_bar_slug}`} className="pressable card mt-4 flex items-center gap-3 p-3">
                <Photo venue={places[person.fav_bar_slug]} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="eyebrow block" style={{ color: "var(--tomato)" }}>
                    Favorite bar
                  </span>
                  <span className="serif block truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                    {places[person.fav_bar_slug].name}
                  </span>
                </span>
              </Link>
            )}
            {ladder.length > 0 && (
              <section className="mt-5">
                <p className="eyebrow">{person.name.split(/\s+/)[0]}&apos;s ladder</p>
                <ol className="mt-1 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
                  {ladder.slice(0, 10).map((s, i) => (
                    <li key={s.slug} style={{ borderColor: "var(--hairline)" }}>
                      <Link href={`/v/${s.slug}`} className="pressable flex items-center gap-3 py-2.5">
                        <span className="serif w-6 shrink-0 text-right" style={{ fontSize: 20, color: i === 0 ? "var(--tomato)" : "var(--chalk-35)" }}>
                          {i + 1}
                        </span>
                        {places[s.slug] && <Photo venue={places[s.slug]} rounded="rounded-[10px]" className="h-10 w-10 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="serif block truncate" style={{ fontSize: 18, lineHeight: 1.1 }}>
                            {places[s.slug]?.name ?? s.slug}
                          </span>
                          {s.note && (
                            <span className="block truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                              “{s.note}”
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {been.length > 0 && (
              <section className="mt-5">
                <p className="eyebrow">Been</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {been.slice(0, 16).map((s) => (
                    <Link key={s.slug} href={`/v/${s.slug}`} className="pressable rounded-full border px-3 py-1 text-[13px]" style={{ borderColor: "var(--hairline-strong)" }}>
                      {places[s.slug]?.name ?? s.slug}
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {want.length > 0 && (
              <section className="mt-5">
                <p className="eyebrow">Wants to go</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {want.slice(0, 16).map((s) => (
                    <Link key={s.slug} href={`/v/${s.slug}`} className="pressable rounded-full px-3 py-1 text-[13px]" style={{ background: "rgba(217,72,43,0.1)", color: "var(--tomato-deep)" }}>
                      {places[s.slug]?.name ?? s.slug}
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {!ladder.length && !been.length && !want.length && (
              <p className="mt-5 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
                Nothing saved yet. Their nights will show up here.
              </p>
            )}
            <div className="mt-6 flex items-center justify-between">
              {relation === "following" && onUnfollow ? (
                <button onClick={onUnfollow} className="pressable text-[12.5px]" style={{ color: "var(--ink-35)" }} data-unfollow>
                  Unfollow
                </button>
              ) : relation === "requested" ? (
                <span className="text-[12.5px]" style={{ color: "var(--ink-35)" }}>
                  Requested
                </span>
              ) : relation === "none" && onFollow ? (
                <button onClick={onFollow} className="pressable btn-ghost h-11 px-5 text-[14px]" data-follow>
                  {person.is_public ? "Follow" : "Request to follow"}
                </button>
              ) : (
                <span />
              )}
              <button onClick={onClose} className="pressable btn-primary h-11 px-6 text-[14px]">
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}


/** "Follow", "Following", "Requested", "Accept": one row per person, with where they stand. */
export function PeopleList({ people, statusOf, busy, onFollow, onUnfollow, onOpen, trailing }: { people: Person[]; statusOf: (p: Person) => "following" | "requested" | "asked-you" | "none"; busy: string | null; onFollow: (p: Person) => void; onUnfollow: (p: Person) => void; onOpen?: (p: Person) => void; /** An extra action per row (the followers list offers Remove). */ trailing?: (p: Person) => React.ReactNode }) {
  return (
    <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }} data-people-list>
      {people.map((p) => {
        const s = statusOf(p);
        return (
          <li key={p.id} className="flex items-center justify-between gap-2 py-3" style={{ borderColor: "var(--hairline)" }} data-person={p.id}>
            {onOpen ? (
              <button onClick={() => onOpen(p)} className="pressable min-w-0 text-left">
                <Who p={p} privateTag={!p.is_public} />
              </button>
            ) : (
              <Who p={p} privateTag={!p.is_public} />
            )}
            <span className="flex shrink-0 items-center gap-2">
              {trailing?.(p)}
              {s === "following" ? (
                <button onClick={() => onUnfollow(p)} disabled={busy === p.id} className="pressable btn-ghost h-9 px-3.5 text-[13px]" data-following>
                  Following
                </button>
              ) : s === "requested" ? (
                <span className="text-[12.5px]" style={{ color: "var(--ink-35)" }}>
                  Requested
                </span>
              ) : (
                <button onClick={() => onFollow(p)} disabled={busy === p.id} className="pressable btn-primary h-9 px-4 text-[13px]" data-follow-btn>
                  {s === "asked-you" ? "Accept" : p.is_public ? "Follow" : "Request"}
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Public (anyone can add you) or private (people request first). Its own card so the YOU page can place it last. */
export function PrivacyCard() {
  const { user, profile, updateProfile } = useAuth();
  const sb = useMemo(() => getSupabase(), []);
  const isPublic = profile?.is_public ?? true;
  const toggle = async (value: boolean) => {
    if (!sb || !user) return;
    updateProfile({ is_public: value });
    try {
      await setPrivacy(sb, user.id, { is_public: value });
    } catch {
      updateProfile({ is_public: !value });
    }
  };
  return (
    <section className="card mt-8 p-5" data-privacy-card>
      <h2 className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
        Who sees you
      </h2>
      <Row label={isPublic ? "Public: anyone can follow you" : "Private: people request first"} on={isPublic} onChange={toggle} />
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-35)" }}>
        Your number is never shown to anyone. People who follow you see your name, your photo, where you live, and your spots.
      </p>
    </section>
  );
}

function Row({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-[14.5px]">{label}</p>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="pressable relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--pine)" : "rgba(22,33,58,0.14)" }}>
        <span className="absolute top-1 h-5 w-5 rounded-full transition-all" style={{ left: on ? 24 : 4, background: "var(--paper)" }} />
      </button>
    </div>
  );
}


/* ───────────────────────── shell + regulars ───────────────────────── */

export function Who({ p, privateTag }: { p: Person; privateTag?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar url={p.avatar_url} name={p.name} size={36} />
      <span className="min-w-0">
        <span className="serif text-[19px]">{p.name}</span>
        {privateTag && (
          <span className="ml-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-35)" }}>
            private
          </span>
        )}
        {p.hometown && (
          <span className="block truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
            Lives in {p.hometown}
          </span>
        )}
      </span>
    </span>
  );
}
