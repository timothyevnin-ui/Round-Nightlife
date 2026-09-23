import "server-only";

/**
 * A brake on the model calls, so a bot (or a bug) can't run up the bill.
 * Per-phone limits by IP plus a ceiling for the whole server, in memory: on
 * Vercel that's per running instance, which is fine for a brake. Over the
 * limit, the app still answers; it just uses the rules engine instead of
 * Claude for a minute.
 */

type Bucket = { tokens: number; at: number };
const buckets = new Map<string, Bucket>();

const PER_MINUTE = Number(process.env.ROUND_AI_PER_MINUTE ?? 10); // per IP
const GLOBAL_PER_MINUTE = Number(process.env.ROUND_AI_GLOBAL_PER_MINUTE ?? 300);

function take(key: string, limit: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: limit, at: now };
  // Refill continuously: `limit` tokens per minute.
  b.tokens = Math.min(limit, b.tokens + ((now - b.at) / 60000) * limit);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 5000) for (const k of [...buckets.keys()].slice(0, 1000)) buckets.delete(k);
  return true;
}

/** True if this caller may spend a model call right now. */
export function allowModelCall(ip: string | null | undefined): boolean {
  if (!take("*", GLOBAL_PER_MINUTE)) return false;
  return take(ip || "unknown", PER_MINUTE);
}

/** The caller's IP as Vercel (or any proxy) reports it. */
export function ipFrom(h: { get(name: string): string | null }): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip");
}
