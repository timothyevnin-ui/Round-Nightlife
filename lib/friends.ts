"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164 } from "./phone";

/**
 * Friends, from the phone's point of view. Everything goes through
 * supabase-js with the person's own session, so the database's rules decide
 * what they can see. The phone book never leaves the phone: numbers are
 * hashed here and only the hashes are compared.
 */

export type Person = { id: string; name: string; is_public: boolean; avatar_url?: string | null; hometown?: string | null };
export type Edge = { user_id: string; friend_id: string; status: "following" | "pending"; at: string };
export type Circle = { friends: Person[]; requestsIn: Person[]; requestsOut: Person[] };
export type Checkin = { user_id: string; slug: string; at: string; name: string };

export const CHECKIN_HOURS = 4;

export async function loadCircle(sb: SupabaseClient, me: string): Promise<Circle> {
  const { data, error } = await sb.from("friends").select("user_id,friend_id,status,at").or(`user_id.eq.${me},friend_id.eq.${me}`);
  if (error) throw error;
  const edges = (data ?? []) as Edge[];
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.user_id);
    ids.add(e.friend_id);
  }
  ids.delete(me);
  const people = await peopleByIds(sb, [...ids]);
  const person = (id: string) => people.get(id);
  const friends: Person[] = [];
  const requestsIn: Person[] = [];
  const requestsOut: Person[] = [];
  for (const e of edges) {
    if (e.user_id === me && e.status === "following") {
      const p = person(e.friend_id);
      if (p) friends.push(p);
    } else if (e.user_id === me && e.status === "pending") {
      const p = person(e.friend_id);
      if (p) requestsOut.push(p);
    } else if (e.friend_id === me && e.status === "pending") {
      const p = person(e.user_id);
      if (p) requestsIn.push(p);
    }
  }
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name);
  return { friends: friends.sort(byName), requestsIn: requestsIn.sort(byName), requestsOut: requestsOut.sort(byName) };
}

/** Whatever the people view has: name and privacy always, a face and a hometown once the V14 schema is in. */
const peopleSelect = (sb: SupabaseClient) => sb.from("people").select("*");

async function peopleByIds(sb: SupabaseClient, ids: string[]): Promise<Map<string, Person>> {
  const out = new Map<string, Person>();
  if (!ids.length) return out;
  const { data, error } = await peopleSelect(sb).in("id", ids);
  if (error) throw error;
  for (const p of (data ?? []) as Person[]) out.set(p.id, { ...p, name: p.name || "Someone" });
  return out;
}

export async function searchPeople(sb: SupabaseClient, me: string, q: string): Promise<Person[]> {
  const clean = q.trim();
  if (clean.length < 2) return [];
  const { data, error } = await peopleSelect(sb).ilike("name", `%${clean.replace(/[%_]/g, "")}%`).neq("id", me).limit(12);
  if (error) throw error;
  return ((data ?? []) as Person[]).filter((p) => p.name);
}

/** "following" (friends now) or "pending" (they're private; they'll get a request). */
export async function befriend(sb: SupabaseClient, target: string): Promise<"following" | "pending"> {
  const { data, error } = await sb.rpc("befriend", { target });
  if (error) throw error;
  return data === "pending" ? "pending" : "following";
}

export async function acceptFriend(sb: SupabaseClient, requester: string): Promise<void> {
  const { error } = await sb.rpc("accept_friend", { requester });
  if (error) throw error;
}

export async function unfriend(sb: SupabaseClient, target: string): Promise<void> {
  const { error } = await sb.rpc("unfriend", { target });
  if (error) throw error;
}

export async function setPrivacy(sb: SupabaseClient, me: string, patch: { is_public?: boolean; share_location?: boolean }): Promise<void> {
  const { error } = await sb.from("profiles").update(patch).eq("id", me);
  if (error) throw error;
}

/** Tap GO → you're "at" that bar for a few hours, for friends who may see it. */
export async function checkIn(sb: SupabaseClient, me: string, slug: string): Promise<void> {
  const { error } = await sb.from("checkins").upsert({ user_id: me, slug, at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function clearCheckIn(sb: SupabaseClient, me: string): Promise<void> {
  await sb.from("checkins").delete().eq("user_id", me);
}

/** Friends who tapped GO in the last few hours (the database only returns the ones allowed to be seen). */
export async function whereFriendsAre(sb: SupabaseClient, me: string): Promise<Checkin[]> {
  const since = new Date(Date.now() - CHECKIN_HOURS * 3600e3).toISOString();
  const { data, error } = await sb.from("checkins").select("user_id,slug,at").gte("at", since).neq("user_id", me).order("at", { ascending: false }).limit(50);
  if (error) throw error;
  const rows = (data ?? []) as Omit<Checkin, "name">[];
  const people = await peopleByIds(sb, rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, name: people.get(r.user_id)?.name ?? "A friend" }));
}

export async function myCheckIn(sb: SupabaseClient, me: string): Promise<{ slug: string; at: string } | null> {
  const since = new Date(Date.now() - CHECKIN_HOURS * 3600e3).toISOString();
  const { data } = await sb.from("checkins").select("slug,at").eq("user_id", me).gte("at", since).maybeSingle();
  return (data as { slug: string; at: string } | null) ?? null;
}

/* ───────────────────────── contacts ───────────────────────── */

type ContactsApi = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };

/** The browser's contact picker, where it exists (iOS Safari, Android Chrome). */
export function contactsSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as unknown as { contacts?: ContactsApi & { getProperties?: () => Promise<string[]> } }).contacts;
  return !!c && typeof c.select === "function";
}

/** Ask for contacts; return their numbers as SHA-256 hashes of the E.164 form. Nothing else is kept. */
export async function pickContactHashes(): Promise<{ hashes: string[]; count: number }> {
  const c = (navigator as unknown as { contacts?: ContactsApi }).contacts;
  if (!c) return { hashes: [], count: 0 };
  const picked = await c.select(["tel"], { multiple: true });
  const numbers = new Set<string>();
  for (const p of picked) for (const t of p.tel ?? []) {
    const e = toE164(t);
    if (e) numbers.add(e);
  }
  const hashes = await Promise.all([...numbers].map(sha256Hex));
  return { hashes, count: picked.length };
}

export async function matchContacts(sb: SupabaseClient, hashes: string[]): Promise<Person[]> {
  if (!hashes.length) return [];
  const { data, error } = await sb.rpc("match_contacts", { hashes });
  if (error) throw error;
  return ((data ?? []) as Person[]).filter((p) => p.name);
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
