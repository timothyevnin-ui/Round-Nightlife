import "server-only";
import { cache } from "react";
import { dbConfig, keyHeaders } from "./db";
import { bestQuestion, type CrowdQuestion } from "./crowdQuestions";
import { getPool } from "./pool";
import type { Crowd } from "@/components/Score";
import type { AttrKey } from "./attrs";
import type { Attrs, CrowdLineRow, Venue, VenueCrowd } from "./types";

/**
 * What New York says, per place (V32): read from the crowd views (counts and
 * first names only, never a phone), folded into each venue as `crowd`. The
 * people's number comes from everyone's ladders; Best for and the badges
 * from their answers; the blended traits let the picker use what the crowd
 * knows about a place ROUND's founder hasn't sat in. Empty when the database
 * isn't set up; never throws.
 */

/** The cache tag on every crowd read: a rating clears it (app/api/event). */
export const CROWD_TAG = "crowd";
/** ROUND's word counts as this many people when the crowd's traits blend in. */
const HOUSE_WEIGHT = 6;
/** A badge shows once this many said it, and at least this share of those who answered that question. */
const BADGE_MIN = 3;
const BADGE_SHARE = 0.4;

type CrowdRow = { slug: string; n: number; back: number; again: number; best_n: number; people: number | null };
type BestRow = { slug: string; key: string; n: number };
type AnswerRow = { slug: string; q: string; opt: string; n: number };
type LineRow = { slug: string; user_id: string; name: string | null; hometown: string | null; avatar_url?: string | null; verdict: CrowdLineRow["verdict"]; rank: number | null; count: number | null; note: string; at: string };

async function view<T>(name: string, query: string, revalidate = 60): Promise<T[]> {
  const { url, anon, configured } = dbConfig();
  if (!configured || !anon) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${name}?${query}`, { headers: keyHeaders(anon), next: { revalidate, tags: [CROWD_TAG] } });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

const slugFilter = (slugs?: string[]) => (slugs?.length ? `&slug=in.(${slugs.map((s) => `"${s}"`).join(",")})` : "");

/** The crowd's counts per place (the old shape, for the spots page and the health check). */
export async function crowdScores(slugs?: string[]): Promise<Record<string, Crowd>> {
  const rows = await view<CrowdRow>("venue_crowd", `select=slug,n,back,again${slugFilter(slugs)}`);
  if (rows.length) return Object.fromEntries(rows.map((r) => [r.slug, { n: r.n, back: r.back, again: r.again }]));
  // Before schema V32 the older view still answers.
  const old = await view<{ slug: string; n: number; back: number; again: number }>("venue_scores", `select=slug,n,back,again${slugFilter(slugs)}`);
  return Object.fromEntries(old.map((r) => [r.slug, { n: r.n, back: r.back, again: r.again }]));
}

function lineRow(r: LineRow): CrowdLineRow {
  return { userId: r.user_id, name: r.name ?? "Someone", hometown: r.hometown, avatar: r.avatar_url ?? null, verdict: r.verdict ?? null, rank: r.rank, count: r.count, note: r.note, at: r.at };
}

/** The lines under one place, newest first. */
export async function linesFor(slug: string, limit = 12): Promise<CrowdLineRow[]> {
  const rows = await view<LineRow>("venue_lines", `select=*&slug=eq.${encodeURIComponent(slug)}&order=at.desc&limit=${limit}`, 30);
  return rows.map(lineRow);
}

type Sums = Record<string, { sum: number; n: number }>;
export type CrowdAll = Record<string, VenueCrowd & { raw: Sums }>;

/** Every place's crowd, memoized per request. `raw` holds the crowd's trait sums before blending. */
export const crowdAll = cache(async (): Promise<CrowdAll> => {
  const [crowd, best, answers, lines, pool] = await Promise.all([
    view<CrowdRow>("venue_crowd", "select=*"),
    view<BestRow>("venue_best_for", "select=*"),
    view<AnswerRow>("venue_answers", "select=*"),
    view<LineRow>("venue_lines", "select=*&order=at.desc&limit=400", 60),
    getPool(),
  ]);
  const out: CrowdAll = {};
  const get = (slug: string) => (out[slug] ??= { n: 0, back: 0, again: 0, bestN: 0, bestFor: [], badges: [], attrs: {}, lines: [], raw: {} });
  for (const r of crowd) Object.assign(get(r.slug), { n: r.n, back: r.back, again: r.again, bestN: r.best_n ?? 0, people: r.n >= 3 && typeof r.people === "number" ? r.people : undefined });
  const bestBySlug = new Map<string, BestRow[]>();
  for (const r of best) bestBySlug.set(r.slug, [...(bestBySlug.get(r.slug) ?? []), r]);
  const answersBySlug = new Map<string, AnswerRow[]>();
  for (const r of answers) answersBySlug.set(r.slug, [...(answersBySlug.get(r.slug) ?? []), r]);
  const linesBySlug = new Map<string, LineRow[]>();
  for (const r of lines) {
    const l = linesBySlug.get(r.slug) ?? [];
    if (l.length < 3) linesBySlug.set(r.slug, [...l, r]);
  }
  for (const slug of new Set([...bestBySlug.keys(), ...answersBySlug.keys(), ...linesBySlug.keys()])) {
    const c = get(slug);
    c.bestFor = bestForOf(bestBySlug.get(slug) ?? [], c.bestN, pool);
    const { raw, badges, round } = fromAnswers(answersBySlug.get(slug) ?? [], pool);
    c.badges = badges;
    c.round = round;
    c.raw = raw;
    c.lines = (linesBySlug.get(slug) ?? []).map(lineRow);
  }
  return out;
});

function bestForOf(rows: BestRow[], bestN: number, pool: CrowdQuestion[]): VenueCrowd["bestFor"] {
  const labels = new Map<string, string>();
  for (const q of pool) if (q.role === "best") for (const o of q.options) if (!labels.has(o.key)) labels.set(o.key, o.label);
  return rows
    .filter((r) => labels.has(r.key))
    .map((r) => ({ key: r.key, label: labels.get(r.key)!, n: r.n, pct: bestN > 0 ? Math.round((100 * r.n) / bestN) : 0 }))
    .sort((a, b) => b.n - a.n);
}

/** The crowd's traits (before blending), the badges, and the round-for-four line, from the answers. */
function fromAnswers(rows: AnswerRow[], pool: CrowdQuestion[]): { raw: Sums; badges: string[]; round?: string } {
  const byId = new Map(pool.map((q) => [q.id, q]));
  const raw: Sums = {};
  // A badge's votes add up across the options that carry it ("Shoulder to shoulder" and "Couldn't move" both say "Always packed").
  const badgeVotes = new Map<string, { votes: number; q: string }>();
  const perQ = new Map<string, number>();
  for (const r of rows) perQ.set(r.q, (perQ.get(r.q) ?? 0) + r.n);
  let round: string | undefined;
  let roundBest = 0;
  for (const r of rows) {
    const q = byId.get(r.q);
    const o = q?.options.find((x) => x.key === r.opt);
    if (!q || !o) continue;
    for (const [k, v] of Object.entries(o.attrs ?? {})) {
      const a = (raw[k] ??= { sum: 0, n: 0 });
      a.sum += (v ?? 0) * r.n;
      a.n += r.n;
    }
    if (o.badge) {
      const b = badgeVotes.get(o.badge) ?? { votes: 0, q: r.q };
      b.votes += r.n;
      badgeVotes.set(o.badge, b);
    }
    if (q.id === "round" && r.n > roundBest && r.n >= 2) {
      roundBest = r.n;
      round = o.label;
    }
  }
  const badges = [...badgeVotes.entries()]
    .filter(([, b]) => b.votes >= BADGE_MIN && b.votes / (perQ.get(b.q) ?? b.votes) >= BADGE_SHARE)
    .sort((a, b) => b[1].votes - a[1].votes)
    .map(([label]) => label)
    .slice(0, 4);
  return { raw, badges, round };
}

/**
 * Fold the crowd into the venues: `crowd` on each, with the traits blended
 * (ROUND's word weighs as six people; the crowd's answers pull from there).
 * Venues the crowd hasn't touched come back as they were.
 */
export function applyCrowd(venues: Venue[], all: CrowdAll): Venue[] {
  return venues.map((v) => {
    const c = all[v.slug];
    if (!c) return v;
    const blended: Partial<Attrs> = {};
    for (const [k, a] of Object.entries(c.raw)) {
      if (!a.n) continue;
      const key = k as AttrKey;
      const house = v.attrs[key] ?? 0.5;
      blended[key] = Math.round(((house * HOUSE_WEIGHT + a.sum) / (HOUSE_WEIGHT + a.n)) * 100) / 100;
    }
    const crowd: VenueCrowd = { n: c.n, back: c.back, again: c.again, people: c.people, bestN: c.bestN, bestFor: c.bestFor, badges: c.badges, attrs: blended, round: c.round, lines: c.lines };
    return { ...v, crowd };
  });
}

/** Venues with the crowd folded in (one read per request). */
export async function withCrowd(venues: Venue[]): Promise<Venue[]> {
  const all = await crowdAll();
  return Object.keys(all).length ? applyCrowd(venues, all) : venues;
}

/** The Best-for labels for a kind of place, for the picker's words. */
export function bestLabels(pool: CrowdQuestion[], kind: "bar" | "restaurant"): Record<string, string> {
  return Object.fromEntries((bestQuestion(pool, kind)?.options ?? []).map((o) => [o.key, o.label]));
}
