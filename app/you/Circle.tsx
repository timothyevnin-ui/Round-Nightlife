"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/AboutYou";
import { acceptFriend, befriend, contactsSupported, friendsSpots, loadCircle, matchContacts, pickContactHashes, removeFollower, searchPeople, unfriend, type Circle, type FriendSpot, type Person } from "@/lib/friends";
import { getSupabase } from "@/lib/supabase";
import { track } from "@/lib/track";
import { FriendSheet, PeopleList, Who, type Place } from "@/app/friends/FriendsView";
import { InviteButton } from "@/app/friends/InviteButton";

/**
 * Your circle (V26): who you follow, who follows you, who's asked. Following
 * is one direction, like everywhere else; a public account is followed on
 * the spot, a private one gets a request. All of it hangs off two numbers
 * on the YOU tab and a Find friends button; tap a number for the list, tap
 * a person for their spots.
 */

export type Relation = "following" | "requested" | "asked-you" | "none";

export function useCircle(me: string | undefined) {
  const sb = useMemo(() => getSupabase(), []);
  const [circle, setCircle] = useState<Circle>({ following: [], followers: [], requestsIn: [], requestsOut: [] });
  const [spots, setSpots] = useState<FriendSpot[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sb || !me) return;
    try {
      const c = await loadCircle(sb, me);
      setCircle(c);
      setProblem(null);
      setSpots(c.following.length ? await friendsSpots(sb, me) : []);
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

  const statusOf = useCallback(
    (p: Person): Relation =>
      circle.following.some((f) => f.id === p.id) ? "following" : circle.requestsOut.some((f) => f.id === p.id) ? "requested" : circle.requestsIn.some((f) => f.id === p.id) ? "asked-you" : "none",
    [circle],
  );

  const follow = useCallback(
    async (p: Person) => {
      if (!sb) return;
      setBusy(p.id);
      try {
        const r = statusOf(p) === "asked-you" ? (await acceptFriend(sb, p.id), "accepted" as const) : await befriend(sb, p.id);
        setNote(r === "accepted" ? `${p.name} follows you now.` : r === "pending" ? `${p.name} is private. They'll get your request.` : `You follow ${p.name}.`);
        track("save", { data: { source: "follow", how: r } });
        await refresh();
      } catch (e) {
        setNote(errMsg(e) || "Couldn't do that.");
      } finally {
        setBusy(null);
      }
    },
    [sb, statusOf, refresh],
  );

  const unfollow = useCallback(
    async (p: Person) => {
      if (!sb) return;
      setBusy(p.id);
      try {
        await unfriend(sb, p.id);
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [sb, refresh],
  );

  const drop = useCallback(
    async (p: Person) => {
      if (!sb) return;
      setBusy(p.id);
      try {
        await removeFollower(sb, p.id);
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [sb, refresh],
  );

  const spotsOf = useCallback((id: string) => spots.filter((s) => s.user_id === id), [spots]);

  return { sb, circle, spots, spotsOf, problem, busy, note, setNote, statusOf, follow, unfollow, drop, refresh };
}

export type CircleApi = ReturnType<typeof useCircle>;

/* ───────────────────────── the sheets ───────────────────────── */

export function Sheet({ open, onClose, label, children, testId }: { open: boolean; onClose: () => void; label: string; children: ReactNode; testId: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(22,33,58,0.42)", backdropFilter: "blur(6px)" }} onClick={onClose} role="dialog" aria-modal aria-label={label} {...{ [testId]: "1" }}>
          <motion.div initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 32 }} onClick={(e) => e.stopPropagation()} className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--hairline)", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--chalk-20)" }} />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Following or followers, as a list; tap a person for their spots. */
export function PeopleSheet({ api, which, onClose, onOpen }: { api: CircleApi; which: "following" | "followers" | null; onClose: () => void; onOpen: (p: Person) => void }) {
  const people = which === "following" ? api.circle.following : which === "followers" ? api.circle.followers : [];
  return (
    <Sheet open={!!which} onClose={onClose} label={which ?? ""} testId="data-people-sheet">
      <div className="flex items-baseline justify-between">
        <h2 className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
          {which === "following" ? "Following" : "Followers"}
        </h2>
        <span className="text-[12.5px]" style={{ color: "var(--ink-35)" }}>
          {people.length}
        </span>
      </div>
      {people.length ? (
        <PeopleList
          people={people}
          statusOf={api.statusOf}
          busy={api.busy}
          onFollow={api.follow}
          onUnfollow={api.unfollow}
          onOpen={onOpen}
          trailing={which === "followers" ? (p) => (
            <button onClick={() => api.drop(p)} disabled={api.busy === p.id} className="pressable text-[12px]" style={{ color: "var(--ink-35)" }} data-remove-follower>
              Remove
            </button>
          ) : undefined}
        />
      ) : (
        <p className="mt-3 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
          {which === "following" ? "Nobody yet. Find friends and follow them." : "Nobody yet. Send your link."}
        </p>
      )}
      <button onClick={onClose} className="pressable btn-primary mt-5 flex h-11 w-full items-center justify-center text-[14px]">
        Done
      </button>
    </Sheet>
  );
}

/** Find friends: your contacts (hashed on the phone), a name, or your link. */
export function FinderSheet({ api, me, open, onClose, onOpen }: { api: CircleApi; me: string; open: boolean; onClose: () => void; onOpen: (p: Person) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Person[]>([]);
  const [matched, setMatched] = useState<Person[] | null>(null);
  const canPick = contactsSupported();
  const clean = q.trim();
  useEffect(() => {
    if (!api.sb || clean.length < 2) return;
    const sb = api.sb;
    const id = window.setTimeout(() => {
      searchPeople(sb, me, clean).then(setHits).catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(id);
  }, [clean, api.sb, me]);
  const shown = clean.length >= 2 ? hits : [];

  const pick = async () => {
    if (!api.sb) return;
    api.setNote(null);
    try {
      const { hashes, count } = await pickContactHashes();
      if (!count) return api.setNote("No contacts picked.");
      const people = await matchContacts(api.sb, hashes);
      setMatched(people);
      api.setNote(people.length ? `${people.length} of your ${count} contacts ${people.length === 1 ? "is" : "are"} on ROUND.` : `None of those ${count} are on ROUND yet. Send them your link.`);
      track("save", { data: { source: "contacts", picked: count, matched: people.length } });
    } catch (e) {
      api.setNote(/abort|cancel/i.test(errMsg(e)) ? null : "Couldn't read contacts.");
    }
  };
  const followAll = async () => {
    if (!api.sb || !matched) return;
    for (const p of matched) if (api.statusOf(p) === "none") await befriend(api.sb, p.id).catch(() => {});
    await api.refresh();
    api.setNote("Done.");
  };

  return (
    <Sheet open={open} onClose={onClose} label="Find friends" testId="data-find">
      <h2 className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
        Find your friends
      </h2>
      {canPick ? (
        <>
          <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
            Pick the contacts you&apos;d go out with. Numbers are matched as scrambled codes; your contacts never leave your phone.
          </p>
          <button onClick={pick} className="pressable btn-accent mt-4 flex h-12 w-full items-center justify-center text-[15px]">
            Allow contacts
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
            <button onClick={followAll} className="pressable text-[12.5px] font-semibold" style={{ color: "var(--tomato)" }}>
              Follow all
            </button>
          </div>
          <PeopleList people={matched} statusOf={api.statusOf} busy={api.busy} onFollow={api.follow} onUnfollow={api.unfollow} onOpen={onOpen} />
        </div>
      )}
      <label className="mt-4 block">
        <span className="eyebrow">Or by name</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a friend's name" className="mt-2 h-12 w-full rounded-full border px-4 text-[15px] outline-none" style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
      </label>
      {clean.length >= 2 && (shown.length ? <PeopleList people={shown} statusOf={api.statusOf} busy={api.busy} onFollow={api.follow} onUnfollow={api.unfollow} onOpen={onOpen} /> : <p className="mt-3 text-[13px]" style={{ color: "var(--ink-35)" }}>Nobody by that name yet.</p>)}
      {api.note && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--ink-70)" }} data-circle-note>
          {api.note}
        </p>
      )}
      <InviteButton />
      <button onClick={onClose} className="pressable btn-ghost mt-3 flex h-11 w-full items-center justify-center text-[14px]">
        Done
      </button>
    </Sheet>
  );
}

/** Somebody's waiting on you: requests to follow a private account. */
export function RequestsCard({ api }: { api: CircleApi }) {
  if (!api.circle.requestsIn.length) return null;
  return (
    <section className="card mt-4 p-4" data-requests>
      <p className="eyebrow" style={{ color: "var(--tomato)" }}>
        Asked to follow you
      </p>
      <ul className="mt-1 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
        {api.circle.requestsIn.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3" style={{ borderColor: "var(--hairline)" }}>
            <Who p={p} />
            <span className="flex gap-2">
              <button onClick={() => api.follow(p)} disabled={api.busy === p.id} className="pressable btn-primary h-9 px-4 text-[13px]">
                Accept
              </button>
              <button onClick={() => api.drop(p)} disabled={api.busy === p.id} className="pressable btn-ghost h-9 px-3 text-[13px]">
                Ignore
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The person sheet, wired to the circle. */
export function PersonSheet({ api, person, places, onClose }: { api: CircleApi; person: Person | null; places: Record<string, Place>; onClose: () => void }) {
  const relation = person ? api.statusOf(person) : "none";
  return (
    <FriendSheet
      person={person}
      spots={person ? api.spotsOf(person.id) : []}
      places={places}
      onClose={onClose}
      relation={relation === "asked-you" ? "none" : relation}
      onFollow={person ? () => void api.follow(person) : undefined}
      onUnfollow={person ? () => { void api.unfollow(person); onClose(); } : undefined}
    />
  );
}

/** A face and a first name, the small kind. */
export function Faces({ people, onOpen, max = 5 }: { people: Person[]; /** Without it the faces are decoration (inside a button that opens the list). */ onOpen?: (p: Person) => void; max?: number }) {
  if (!people.length) return null;
  return (
    <span className="flex -space-x-2" data-faces>
      {people.slice(0, max).map((p) =>
        onOpen ? (
          <button key={p.id} onClick={() => onOpen(p)} className="pressable rounded-full" style={{ boxShadow: "0 0 0 2px var(--paper)" }} aria-label={p.name}>
            <Avatar url={p.avatar_url} name={p.name} size={32} />
          </button>
        ) : (
          <span key={p.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--paper)" }} title={p.name}>
            <Avatar url={p.avatar_url} name={p.name} size={32} />
          </span>
        ),
      )}
    </span>
  );
}

/** supabase-js errors are plain objects, not Errors. */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "";
}
