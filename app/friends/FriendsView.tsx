"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Photo } from "@/components/Photo";
import { TypedHeading, useTypewriter } from "@/components/QuickOnes";
import { useAuth } from "@/lib/auth";
import { acceptFriend, befriend, CHECKIN_HOURS, clearCheckIn, contactsSupported, loadCircle, matchContacts, myCheckIn, pickContactHashes, searchPeople, setPrivacy, unfriend, whereFriendsAre, type Checkin, type Circle, type Person } from "@/lib/friends";
import { neighborhoodName } from "@/lib/neighborhoods";
import { getSupabase } from "@/lib/supabase";
import { track } from "@/lib/track";
import type { NeighborhoodId, Venue } from "@/lib/types";
import { InviteButton } from "./InviteButton";

export type Regular = { slug: string; name: string; neighborhood: NeighborhoodId; tags: string[]; photo: Venue["photo"]; photoUrl?: string; regulars: number };

/**
 * Friends. Signed out, it's the pitch: the reason to add your number, typed
 * out the way the questions are. Signed in, it's your people: who's out
 * tonight, who to add, who asked, and how private you want to be.
 */
const LATER_KEY = "round:friends-later";
const laterListeners = new Set<() => void>();
const laterStore = {
  subscribe(fn: () => void) {
    laterListeners.add(fn);
    return () => {
      laterListeners.delete(fn);
    };
  },
  get() {
    try {
      return sessionStorage.getItem(LATER_KEY) === "1";
    } catch {
      return false;
    }
  },
  set(v: boolean) {
    try {
      sessionStorage.setItem(LATER_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    laterListeners.forEach((fn) => fn());
  },
};

export function FriendsView({ regulars, names }: { regulars: Regular[]; names: Record<string, string> }) {
  const { enabled, ready, user, openSignIn } = useAuth();
  const later = useSyncExternalStore(laterStore.subscribe, laterStore.get, () => false);

  if (!enabled) return <Shell title="Friends" eyebrow="Mutual, not public"><Regulars regulars={regulars} intro /></Shell>;
  if (!ready) return <Shell title="Friends" eyebrow="Mutual, not public" />;

  if (!user) {
    if (!later)
      return (
        <Pitch
          onAdd={() => {
            track("save", { data: { source: "friends-pitch" } });
            openSignIn("friends");
          }}
          onLater={() => laterStore.set(true)}
        />
      );
    return (
      <Shell title="Friends" eyebrow="Mutual, not public">
        <section className="card p-5">
          <p className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>
            Your friends are one text away.
          </p>
          <p className="mt-2 text-[14.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
            Add your number and we&apos;ll match it against your contacts: whoever&apos;s already here becomes a friend, and you&apos;ll see where they are tonight.
          </p>
          <button onClick={() => openSignIn("friends")} className="pressable btn-accent mt-5 flex h-12 w-full items-center justify-center text-[15px]">
            Add my number
          </button>
        </section>
        <Regulars regulars={regulars} />
      </Shell>
    );
  }

  return <CircleView me={user.id} names={names} />;
}

/* ───────────────────────── the pitch ───────────────────────── */

const BENEFITS = [
  { t: "See which friends are already here.", s: "Your contacts who have ROUND become your friends. Nobody's number is shown to anyone." },
  { t: "See what bar they're at tonight.", s: "When a friend taps GO, you'll know. You choose who sees yours, or turn it off." },
  { t: "Rank your spots.", s: "Loved, Good, Meh. Your favorites climb the list, and ROUND gets you." },
  { t: "A drink on us at your favorite bar.", s: "Add your number now and you're first in line when it opens." },
  { t: "Soon: your friends' and your favorite people's picks.", s: "Where the group actually went last Saturday, not what an ad says." },
];

function Pitch({ onAdd, onLater }: { onAdd: () => void; onLater: () => void }) {
  const first = "Put your number in.";
  const second = "We'll connect you with your friends.";
  const t1 = useTypewriter(first, 34);
  const done1 = t1.length >= first.length;
  return (
    <main className="screen screen-with-tabs relative mx-auto flex w-full max-w-md flex-col overflow-hidden" style={{ minHeight: "100dvh" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 55% at 50% -10%, rgba(217,72,43,0.16), transparent 70%)" }} />
      <header className="relative z-10 pt-5">
        <p className="eyebrow">Friends</p>
      </header>
      <section className="relative z-10 flex flex-1 flex-col pt-8">
        <TypedHeading text={first} typed={t1} ready={done1} size={40} />
        {done1 && <SecondLine text={second} />}
        <motion.ul initial="hidden" animate={done1 ? "show" : "hidden"} variants={{ show: { transition: { staggerChildren: 0.18, delayChildren: 1.1 } } }} className="mt-8 flex flex-col gap-4">
          {BENEFITS.map((b) => (
            <motion.li key={b.t} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--tomato)" }} />
              <span>
                <span className="block text-[16px] font-medium">{b.t}</span>
                <span className="block text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
                  {b.s}
                </span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={done1 ? { opacity: 1, y: 0 } : {}} transition={{ delay: 2.2 }} className="mt-auto pt-8">
          <button onClick={onAdd} className="pressable btn-accent flex h-14 w-full items-center justify-center text-[17px]">
            Add my number
          </button>
          <button onClick={onLater} className="pressable mx-auto mt-3 block text-[13.5px] font-medium" style={{ color: "var(--ink-35)" }}>
            Maybe later
          </button>
          <p className="mt-4 text-center text-[11.5px] leading-relaxed" style={{ color: "var(--ink-35)" }}>
            One text with a code. Never marketing texts. 21+ only.
          </p>
        </motion.div>
      </section>
    </main>
  );
}

function SecondLine({ text }: { text: string }) {
  const typed = useTypewriter(text, 34);
  return (
    <h2 className="serif mt-2" style={{ fontSize: 30, lineHeight: 1.08, letterSpacing: "-0.015em", color: "var(--ink-70)", minHeight: "2.2em" }} aria-label={text}>
      {typed}
      <span aria-hidden className="inline-block align-baseline" style={{ width: 3, height: "0.8em", marginLeft: 3, background: typed.length >= text.length ? "transparent" : "var(--tomato)", transform: "translateY(0.1em)" }} />
    </h2>
  );
}

/* ───────────────────────── signed in ───────────────────────── */

function CircleView({ me, names }: { me: string; names: Record<string, string> }) {
  const { profile, updateProfile } = useAuth();
  const sb = useMemo(() => getSupabase(), []);
  const [circle, setCircle] = useState<Circle>({ friends: [], requestsIn: [], requestsOut: [] });
  const [out, setOut] = useState<Checkin[]>([]);
  const [mine, setMine] = useState<{ slug: string; at: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Person[]>([]);
  const [matched, setMatched] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canPick = contactsSupported();

  const refresh = useCallback(async () => {
    if (!sb) return;
    try {
      const [c, w, m] = await Promise.all([loadCircle(sb, me), whereFriendsAre(sb, me), myCheckIn(sb, me)]);
      setCircle(c);
      setOut(w);
      setMine(m);
      setProblem(null);
    } catch (e) {
      const msg = errMsg(e);
      setProblem(/relation|does not exist|schema cache|Could not find/i.test(msg) ? "Friends aren't switched on in the database yet." : msg);
    }
  }, [sb, me]);

  useEffect(() => {
    // Kicked off from a task, not the effect body: the state lands when the data does.
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  // Name search, a beat after typing stops.
  const clean = q.trim();
  useEffect(() => {
    if (!sb || clean.length < 2) return;
    const id = window.setTimeout(() => {
      searchPeople(sb, me, clean).then(setHits).catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(id);
  }, [clean, sb, me]);
  const shown = clean.length >= 2 ? hits : [];

  const statusOf = (p: Person): "friend" | "requested" | "asked-you" | "none" =>
    circle.friends.some((f) => f.id === p.id) ? "friend" : circle.requestsOut.some((f) => f.id === p.id) ? "requested" : circle.requestsIn.some((f) => f.id === p.id) ? "asked-you" : "none";

  const add = async (p: Person) => {
    if (!sb) return;
    setBusy(p.id);
    try {
      const r = statusOf(p) === "asked-you" ? (await acceptFriend(sb, p.id), "following") : await befriend(sb, p.id);
      setNote(r === "pending" ? `${p.name} is private. They'll get your request.` : `You and ${p.name} are friends.`);
      track("save", { data: { source: "friend-add", how: r } });
      await refresh();
    } catch (e) {
      setNote(errMsg(e) || "Couldn't add them.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: Person) => {
    if (!sb) return;
    setBusy(p.id);
    try {
      await unfriend(sb, p.id);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    if (!sb) return;
    setBusy("contacts");
    setNote(null);
    try {
      const { hashes, count } = await pickContactHashes();
      if (!count) return setNote("No contacts picked.");
      const people = await matchContacts(sb, hashes);
      setMatched(people);
      setNote(people.length ? `${people.length} of your ${count} contacts ${people.length === 1 ? "is" : "are"} on ROUND.` : `None of those ${count} are on ROUND yet. Send them your link.`);
      track("save", { data: { source: "contacts", picked: count, matched: people.length } });
    } catch (e) {
      setNote(/abort|cancel/i.test(errMsg(e)) ? null : "Couldn't read contacts.");
    } finally {
      setBusy(null);
    }
  };

  const addAll = async () => {
    if (!sb || !matched) return;
    setBusy("all");
    for (const p of matched) if (statusOf(p) === "none") await befriend(sb, p.id).catch(() => {});
    await refresh();
    setBusy(null);
    setNote("Done.");
  };

  const togglePrivacy = async (key: "is_public" | "share_location", value: boolean) => {
    if (!sb) return;
    updateProfile({ [key]: value });
    try {
      await setPrivacy(sb, me, { [key]: value });
    } catch {
      updateProfile({ [key]: !value });
    }
  };

  const isPublic = profile?.is_public ?? true;
  const shares = profile?.share_location ?? true;

  return (
    <Shell title="Friends" eyebrow="Mutual, not public">
      {problem && (
        <p className="card mt-1 p-4 text-[13.5px]" style={{ color: "var(--tomato-deep)" }}>
          {problem}
        </p>
      )}

      {/* Where everyone is */}
      <section className="mt-2">
        <div className="flex items-baseline justify-between">
          <h2 className="serif" style={{ fontSize: 26, letterSpacing: "-0.01em" }}>
            Out right now
          </h2>
          <span className="text-[12px]" style={{ color: "var(--ink-35)" }}>
            Last {CHECKIN_HOURS} hours
          </span>
        </div>
        {mine && (
          <div className="mt-3 flex items-center justify-between rounded-[18px] px-4 py-3" style={{ background: "var(--ink)", color: "var(--paper)" }}>
            <span className="text-[14px]">
              You&apos;re at <strong>{names[mine.slug] ?? mine.slug}</strong> · {ago(mine.at)}
            </span>
            <button
              onClick={async () => {
                if (!sb) return;
                await clearCheckIn(sb, me);
                setMine(null);
              }}
              className="pressable text-[12.5px]"
              style={{ color: "var(--on-photo-60)" }}
            >
              Clear
            </button>
          </div>
        )}
        {out.length === 0 ? (
          <p className="mt-3 text-[14px] leading-snug" style={{ color: "var(--ink-55)" }}>
            Nobody&apos;s out yet. When a friend taps GO, it shows up here{shares ? ", and yours shows for them" : ""}.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {out.map((c) => (
              <li key={c.user_id}>
                <Link href={`/v/${c.slug}`} className="pressable flex items-center justify-between py-3">
                  <span>
                    <span className="serif text-[19px]">{c.name}</span>
                    <span className="ml-2 text-[14px]" style={{ color: "var(--ink-70)" }}>
                      at {names[c.slug] ?? c.slug}
                    </span>
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--ink-35)" }}>
                    {ago(c.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Find people */}
      <section className="card mt-8 p-5">
        <h2 className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
          Find your friends
        </h2>
        {canPick ? (
          <>
            <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
              Pick the contacts you&apos;d go out with. Numbers are matched as scrambled codes; your contacts never leave your phone.
            </p>
            <button onClick={pick} disabled={busy === "contacts"} className="pressable btn-accent mt-4 flex h-12 w-full items-center justify-center text-[15px]" style={{ opacity: busy === "contacts" ? 0.6 : 1 }}>
              {busy === "contacts" ? "Matching…" : "Allow contacts"}
            </button>
          </>
        ) : (
          <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
            Matching your contacts works from Safari on an iPhone. Here, search by name or send your link.
          </p>
        )}
        {matched && matched.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">In your contacts</p>
              <button onClick={addAll} disabled={busy === "all"} className="pressable text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }}>
                Add all
              </button>
            </div>
            <PeopleList people={matched} statusOf={statusOf} busy={busy} onAdd={add} onRemove={remove} />
          </div>
        )}
        <label className="mt-4 block">
          <span className="eyebrow">Or by name</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a friend's name" className="mt-2 h-12 w-full rounded-full border px-4 text-[15px] outline-none" style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
        </label>
        {clean.length >= 2 && (shown.length ? <PeopleList people={shown} statusOf={statusOf} busy={busy} onAdd={add} onRemove={remove} /> : <p className="mt-3 text-[13px]" style={{ color: "var(--ink-35)" }}>Nobody by that name yet.</p>)}
        {note && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-70)" }}>
            {note}
          </p>
        )}
        <InviteButton />
      </section>

      {/* Requests */}
      {circle.requestsIn.length > 0 && (
        <section className="mt-8">
          <h2 className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
            Asked to be friends
          </h2>
          <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {circle.requestsIn.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="serif text-[19px]">{p.name}</span>
                <span className="flex gap-2">
                  <button onClick={() => add(p)} disabled={busy === p.id} className="pressable btn-primary h-9 px-4 text-[13px]">
                    Accept
                  </button>
                  <button onClick={() => remove(p)} disabled={busy === p.id} className="pressable btn-ghost h-9 px-3 text-[13px]">
                    Ignore
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Friends */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
            {circle.friends.length ? `${circle.friends.length} ${circle.friends.length === 1 ? "friend" : "friends"}` : "No friends yet"}
          </h2>
          {circle.requestsOut.length > 0 && (
            <span className="text-[12px]" style={{ color: "var(--ink-35)" }}>
              {circle.requestsOut.length} requested
            </span>
          )}
        </div>
        {circle.friends.length > 0 && (
          <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
            {circle.friends.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <span className="serif text-[19px]">{p.name}</span>
                <button onClick={() => remove(p)} disabled={busy === p.id} className="pressable text-[12px]" style={{ color: "var(--ink-35)" }}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {circle.requestsOut.length > 0 && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
            Waiting on {circle.requestsOut.map((p) => p.name).join(", ")}.
          </p>
        )}
      </section>

      {/* Privacy */}
      <section className="card mt-8 p-5">
        <h2 className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
          Who sees you
        </h2>
        <Row label={isPublic ? "Public: anyone can add you" : "Private: people request first"} on={isPublic} onChange={(v) => togglePrivacy("is_public", v)} />
        <Row label="Friends can see which bar I'm at" on={shares} onChange={(v) => togglePrivacy("share_location", v)} />
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-35)" }}>
          Your number is never shown to anyone. Friends see your name, your Loved list, and, if you allow it, the bar you tapped GO on for {CHECKIN_HOURS} hours.
        </p>
      </section>
    </Shell>
  );
}

function PeopleList({ people, statusOf, busy, onAdd, onRemove }: { people: Person[]; statusOf: (p: Person) => "friend" | "requested" | "asked-you" | "none"; busy: string | null; onAdd: (p: Person) => void; onRemove: (p: Person) => void }) {
  return (
    <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
      {people.map((p) => {
        const s = statusOf(p);
        return (
          <li key={p.id} className="flex items-center justify-between py-3">
            <span>
              <span className="serif text-[19px]">{p.name}</span>
              {!p.is_public && (
                <span className="ml-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-35)" }}>
                  private
                </span>
              )}
            </span>
            {s === "friend" ? (
              <button onClick={() => onRemove(p)} disabled={busy === p.id} className="pressable btn-ghost h-9 px-3.5 text-[13px]">
                Friends
              </button>
            ) : s === "requested" ? (
              <span className="text-[12.5px]" style={{ color: "var(--ink-35)" }}>
                Requested
              </span>
            ) : (
              <button onClick={() => onAdd(p)} disabled={busy === p.id} className="pressable btn-primary h-9 px-4 text-[13px]">
                {s === "asked-you" ? "Accept" : p.is_public ? "Add" : "Request"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
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

/** supabase-js errors are plain objects, not Errors. */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e ?? "");
}

function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

/* ───────────────────────── shell + regulars ───────────────────────── */

function Shell({ title, eyebrow, children }: { title: string; eyebrow: string; children?: React.ReactNode }) {
  return (
    <main className="screen screen-with-tabs mx-auto w-full max-w-md">
      <header className="pt-5 pb-4">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="serif mt-1" style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {title}
        </h1>
      </header>
      {children}
    </main>
  );
}

function Regulars({ regulars, intro }: { regulars: Regular[]; intro?: boolean }) {
  return (
    <>
      {intro && (
        <section className="card p-5">
          <p className="serif" style={{ fontSize: 24, lineHeight: 1.2 }}>
            Your friends aren&apos;t on ROUND yet.
          </p>
          <p className="mt-2 text-[14.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
            When they are, their nights out quietly shape your picks. No feed, no followers, no performance.
          </p>
          <InviteButton />
        </section>
      )}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="serif" style={{ fontSize: 26, letterSpacing: "-0.01em" }}>
            ROUND&apos;s regulars
          </h2>
          <span className="text-[12px]" style={{ color: "var(--ink-35)" }}>
            Where the room keeps going back
          </span>
        </div>
        <div className="mt-3 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
          {regulars.map((v) => (
            <Link key={v.slug} href={`/v/${v.slug}`} className="pressable flex items-center gap-3 py-3">
              <Photo venue={v} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                  {v.name}
                </p>
                <p className="truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                  {neighborhoodName(v.neighborhood)} · {v.tags.join(" · ")}
                </p>
              </div>
              <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--ink-55)" }}>
                {v.regulars} regulars
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
