import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { revalidateTag } from "next/cache";
import { ATTR_LIST } from "./attrs";
import { cleanQuestion, SEED_QUESTIONS, type CrowdQuestion, type Coverage } from "./crowdQuestions";
import { dbConfig, keyHeaders, serviceHeaders } from "./db";
import { listEvents } from "./events";
import { getSettings } from "./settings";
import type { Venue } from "./types";

/**
 * The question pool, server side (V32). The pool lives in crowd_questions;
 * until that table exists (or while it's empty) the seed in
 * lib/crowdQuestions.ts is the pool. `refreshQuestions` has the AI read the
 * last few hundred asks and rewrite the pool so it asks what the city asks
 * for; `writeQuestionFor` has it write one question for one place.
 */

export const POOL_TAG = "pool";
const MODEL = () => process.env.ROUND_TEXT_MODEL ?? "claude-haiku-4-5-20251001";

type Row = { id: string; kind: string; role: string; prompt: string; sub: string | null; multi: boolean; options: unknown; demand: number | string; source: string | null; slug: string | null; active: boolean; ai: boolean };

function rowToQuestion(r: Row): CrowdQuestion | null {
  return cleanQuestion({ id: r.id, kind: r.kind, role: r.role, prompt: r.prompt, sub: r.sub ?? undefined, multi: r.multi, options: r.options, demand: Number(r.demand), from: r.source ?? undefined, slug: r.slug ?? undefined, active: r.active, ai: r.ai });
}

function questionToRow(q: CrowdQuestion): Row {
  return { id: q.id, kind: q.kind, role: q.role, prompt: q.prompt, sub: q.sub ?? null, multi: q.multi, options: q.options, demand: q.demand, source: q.from ?? null, slug: q.slug ?? null, active: q.active, ai: !!q.ai };
}

/** Rows from the table, or null when there's no table. Retired rows included. */
async function fetchRows(fresh = false): Promise<Row[] | null> {
  const { url, anon, configured } = dbConfig();
  if (!configured || !anon) return null;
  try {
    const res = await fetch(`${url}/rest/v1/crowd_questions?select=*&order=created_at.asc`, { headers: keyHeaders(anon), ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 60, tags: [POOL_TAG] } }) });
    if (!res.ok) return null;
    return (await res.json()) as Row[];
  } catch {
    return null;
  }
}

/**
 * The whole pool, retired questions included (the Studio shows them). The
 * table's rows win by id; seed questions the table doesn't know are added,
 * so a fresh database still asks something.
 */
export async function getPoolAll(fresh = false): Promise<{ pool: CrowdQuestion[]; table: boolean }> {
  const rows = await fetchRows(fresh);
  const fromDb = (rows ?? []).map(rowToQuestion).filter((q): q is CrowdQuestion => !!q);
  const have = new Set(fromDb.map((q) => q.id));
  return { pool: [...fromDb, ...SEED_QUESTIONS.filter((q) => !have.has(q.id))], table: rows !== null };
}

/** The live pool: what the rating sheet asks from. */
export async function getPool(): Promise<CrowdQuestion[]> {
  const [{ pool }, { barsOnly }] = await Promise.all([getPoolAll(), getSettings()]);
  return pool.filter((q) => q.active && (!barsOnly || q.kind !== "restaurant"));
}

/** Save questions (new or changed). Service role. */
export async function savePoolRows(qs: CrowdQuestion[]): Promise<void> {
  if (!qs.length) return;
  const { url, headers } = serviceHeaders();
  const res = await fetch(`${url}/rest/v1/crowd_questions?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(qs.map(questionToRow)),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Couldn't save the questions (${res.status}). Run the latest schema.sql first.`);
  try {
    revalidateTag(POOL_TAG, "max");
  } catch {
    /* outside a request (background work): the 60s cache catches up on its own */
  }
}

/** How many answers each question has about one place. Empty when the view isn't there. */
export async function coverageFor(slug: string): Promise<Coverage> {
  const { url, anon, configured } = dbConfig();
  if (!configured || !anon) return {};
  try {
    const res = await fetch(`${url}/rest/v1/venue_answers?select=q,n&slug=eq.${encodeURIComponent(slug)}`, { headers: keyHeaders(anon), next: { revalidate: 30, tags: ["crowd"] } });
    if (!res.ok) return {};
    const rows = (await res.json()) as { q: string; n: number }[];
    const out: Coverage = {};
    // One rating answers a question once; options of a multi question each count a row, so the max per question is the honest number.
    for (const r of rows) out[r.q] = Math.max(out[r.q] ?? 0, r.n);
    return out;
  } catch {
    return {};
  }
}

/* ───────────────────────── the AI ───────────────────────── */

function parseJson(text: string): Record<string, unknown> {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  return JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>;
}

/**
 * Read the asks, rewrite the pool. The model sees what people typed into
 * "just say it" and searched for, plus the current pool, and hands back the
 * pool it would ask: reworded questions, new ones for needs that keep coming
 * up, demand numbers, and the ids to retire. Place-specific questions are
 * left alone here.
 */
export async function refreshQuestions(): Promise<{ changed: number; retired: number; asks: number; error?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { changed: 0, retired: 0, asks: 0, error: "Add ANTHROPIC_API_KEY to the deployment to let the AI write questions." };
  const { pool, table } = await getPoolAll(true);
  if (!table) return { changed: 0, retired: 0, asks: 0, error: "The crowd_questions table isn't there yet. Run the latest schema.sql." };
  let asks: string[] = [];
  try {
    const events = await listEvents({ limit: 600, sinceDays: 90 });
    asks = events.filter((e) => (e.kind === "sayit" || e.kind === "search") && e.q).map((e) => e.q!.replace(/\s+/g, " ").trim().slice(0, 160));
  } catch {
    asks = [];
  }
  const counts = new Map<string, number>();
  for (const a of asks) counts.set(a.toLowerCase(), (counts.get(a.toLowerCase()) ?? 0) + 1);
  const askLines = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([q, n]) => (n > 1 ? `${q} (×${n})` : q));
  const general = pool.filter((q) => !q.slug);
  const client = new Anthropic({ apiKey: key, timeout: 40000, maxRetries: 0 });
  const res = await client.messages.create({
    model: MODEL(),
    max_tokens: 4000,
    system:
      "You design the questions ROUND (a NYC nightlife app, for people 22 to 29) asks when someone rates a bar or restaurant they've been to. " +
      "The point of a question is to make the picker better at answering what New Yorkers actually ask for. You are given the real asks and the current pool. " +
      "Rewrite the pool: keep what's working, reword what's generic, add a question for any need that keeps coming up in the asks and isn't covered, retire what nobody asks about. " +
      "Rules: every question is answered by tapping chips (2 to 8 options), in the voice of a friend texting, never a survey (\"Could eight of you watch a game here?\" not \"Rate the sports-viewing experience\"). " +
      "Every option maps to the picker's traits (attrs, 0 to 1) where it honestly can; an option can also carry a badge (2 words max) for the card when enough people agree, like \"Always packed\" or \"Good people\". " +
      "Keep exactly one role=best question per kind (bar, restaurant): its options are the things the city asks to do (\"Late night\", \"Watching the game\", \"Drinks before going out\"), 6 to 8 of them, multi. " +
      "Between 8 and 16 role=ask questions total, each kind=bar, restaurant or both. Keep ids stable when you keep a question. demand is 0 to 3: how often the asks call for what this question learns. " +
      "Respond with JSON only.",
    messages: [
      {
        role: "user",
        content:
          `What people asked (most common first):\n${askLines.join("\n") || "(no asks logged yet; write the pool from what New Yorkers in their 20s ask about bars)"}\n\n` +
          `Current pool:\n${JSON.stringify(general.map((q) => ({ ...q, ai: undefined })))}\n\n` +
          `Traits (attrs keys):\n${ATTR_LIST.map((a) => `${a.key}: ${a.label} — ${a.hint}`).join("\n")}\n\n` +
          `Return {"questions": [{"id","kind","role","prompt","sub"?,"multi","options":[{"key","label","attrs":{trait: 0..1},"badge"?}],"demand","from": the ask(s) this answers}], "retire": [ids]}.`,
      },
    ],
  });
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const json = parseJson(text);
  const incoming = (Array.isArray(json.questions) ? json.questions : []).map((q) => cleanQuestion({ ...(q as object), ai: true })).filter((q): q is CrowdQuestion => !!q && !q.slug);
  const retire = new Set((Array.isArray(json.retire) ? json.retire : []).filter((x): x is string => typeof x === "string"));
  // One best question per kind, at most.
  const bestSeen = new Set<string>();
  const kept: CrowdQuestion[] = [];
  for (const q of incoming) {
    if (q.role === "best") {
      const k = q.kind === "both" ? "bar" : q.kind;
      if (bestSeen.has(k)) continue;
      bestSeen.add(k);
    }
    kept.push({ ...q, active: true });
  }
  if (kept.filter((q) => q.role === "ask").length < 5) return { changed: 0, retired: 0, asks: askLines.length, error: "The AI came back with too few questions; nothing changed." };
  const byId = new Map(general.map((q) => [q.id, q]));
  const writes: CrowdQuestion[] = [];
  for (const q of kept) {
    const prev = byId.get(q.id);
    if (!prev || JSON.stringify({ ...prev, ai: undefined, active: undefined }) !== JSON.stringify({ ...q, ai: undefined, active: undefined }) || !prev.active) writes.push(q);
  }
  const keptIds = new Set(kept.map((q) => q.id));
  let retiredN = 0;
  for (const q of general) {
    if ((retire.has(q.id) || !keptIds.has(q.id)) && q.active) {
      writes.push({ ...q, active: false });
      retiredN++;
    }
  }
  await savePoolRows(writes);
  return { changed: writes.length - retiredN, retired: retiredN, asks: askLines.length };
}

/**
 * One question for one place, from ROUND's own entry: the thing the take
 * hints at but doesn't settle ("Is there a band every night?"). Written
 * once per place, kept in the pool with the slug on it. Background work:
 * the rating sheet never waits for it.
 */
export async function writeQuestionFor(v: Venue): Promise<CrowdQuestion | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const { pool, table } = await getPoolAll(true);
  if (!table || pool.some((q) => q.slug === v.slug)) return null;
  const client = new Anthropic({ apiKey: key, timeout: 15000, maxRetries: 0 });
  const res = await client.messages.create({
    model: MODEL(),
    max_tokens: 600,
    system:
      "You write one question ROUND (a NYC nightlife app) asks people who have been to one specific bar or restaurant, to learn the thing ROUND's own entry hints at but doesn't settle. " +
      "Chips, 2 to 5 options, a friend's voice, never a survey. Each option maps to traits (attrs 0..1) where it honestly can. Respond with JSON only.",
    messages: [
      {
        role: "user",
        content:
          `Place: ${v.name} (${v.kind}). ROUND says: "${v.take}"${v.theCatch ? ` Catch: "${v.theCatch}"` : ""} Tags: ${v.tags.join(", ") || "none"}.\n` +
          `Traits: ${ATTR_LIST.map((a) => a.key).join(", ")}.\n` +
          `Return {"prompt": string, "multi": boolean, "options": [{"key","label","attrs":{trait: 0..1}}]}.`,
      },
    ],
  });
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const json = parseJson(text);
  const q = cleanQuestion({ ...json, id: `v-${v.slug}`, kind: v.kind, role: "ask", demand: 2, slug: v.slug, from: `Written for ${v.name}`, ai: true, active: true });
  if (!q) return null;
  await savePoolRows([q]);
  return q;
}
