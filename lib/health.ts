import "server-only";
import { dbConfig, serviceHeaders } from "./db";

/**
 * Is the database the shape this version of the code expects? Probes each
 * table and the newer columns with the secret key and names exactly what's
 * missing, so the fix is always "run schema.sql", never a mystery.
 */

export type HealthItem = { key: string; label: string; what: string; ok: boolean; detail?: string };
export type Health = { configured: boolean; writable: boolean; items: HealthItem[]; missing: HealthItem[]; checkedAt: string };

const PROBES: { key: string; label: string; what: string; path: string }[] = [
  { key: "venues", label: "Places", what: "the venues table", path: "venues?select=slug&limit=1" },
  { key: "venues.story", label: "What's hot + stories", what: "the hot, hot_rank and story columns on venues (V4)", path: "venues?select=hot,hot_rank,story&limit=1" },
  { key: "venues.photo_credit", label: "Photo credits", what: "the photo_credit column on venues (V5)", path: "venues?select=photo_credit&limit=1" },
  { key: "profiles", label: "Accounts", what: "the profiles table (V3)", path: "profiles?select=id&limit=1" },
  { key: "saves", label: "Saves and ratings", what: "the saves table (V3)", path: "saves?select=slug&limit=1" },
  { key: "go_taps", label: "GO taps", what: "the go_taps table (V3)", path: "go_taps?select=slug&limit=1" },
  { key: "suggestions", label: "Recommendations inbox", what: "the suggestions table (V5)", path: "suggestions?select=id&limit=1" },
  { key: "events", label: "Activity log", what: "the events table (V7)", path: "events?select=id&limit=1" },
  { key: "profiles.privacy", label: "Public / private accounts", what: "the phone_hash, is_public and share_location columns on profiles (V8)", path: "profiles?select=phone_hash,is_public,share_location&limit=1" },
  { key: "people", label: "Finding friends by name", what: "the people view (V8)", path: "people?select=id&limit=1" },
  { key: "friends", label: "Friends", what: "the friends table and its functions (V8)", path: "friends?select=user_id&limit=1" },
  { key: "checkins", label: "Where friends are", what: "the checkins table (V8)", path: "checkins?select=user_id&limit=1" },
  { key: "venues.hours", label: "Hours, food and ROUND's score", what: "the hours, bar_food, cuisine and score columns on venues (V11)", path: "venues?select=hours,bar_food,cuisine,score&limit=1" },
  { key: "venues.day_deal", label: "Day deals", what: "the day_deal column on venues (V12)", path: "venues?select=day_deal&limit=1" },
  { key: "profiles.about", label: "About you", what: "the hometown, favorites, fun and avatar_url columns on profiles (V14)", path: "profiles?select=hometown,fav_bar,fav_bar_slug,fav_restaurant,fun,avatar_url&limit=1" },
  { key: "saves.verdict", label: "Rate this bar", what: "the verdict, tags, rank and note columns on saves (V11)", path: "saves?select=verdict,tags,rank,note&limit=1" },
  { key: "venue_tags", label: "What people say a place is", what: "the venue_tags view (V11)", path: "venue_tags?select=slug&limit=1" },
  { key: "venue_scores", label: "The crowd's score", what: "the venue_scores view (V11)", path: "venue_scores?select=slug&limit=1" },
];

function explain(status: number, text: string): string {
  if (status === 404 || /relation .* does not exist|Could not find the table/i.test(text)) return "table missing";
  const col = text.match(/Could not find the '([a-z_]+)' column|column "?([a-z_.]+)"? does not exist/i);
  if (col) return `column ${col[1] ?? col[2]} missing`;
  return `${status}: ${text.slice(0, 120)}`;
}

export async function checkDatabase(): Promise<Health> {
  const { configured, writable } = dbConfig();
  const checkedAt = new Date().toISOString();
  if (!writable) return { configured, writable, items: [], missing: [], checkedAt };
  const { url, headers } = serviceHeaders();
  const items: HealthItem[] = await Promise.all(
    PROBES.map(async (p) => {
      try {
        const res = await fetch(`${url}/rest/v1/${p.path}`, { headers, cache: "no-store" });
        if (res.ok) return { key: p.key, label: p.label, what: p.what, ok: true };
        return { key: p.key, label: p.label, what: p.what, ok: false, detail: explain(res.status, await res.text()) };
      } catch (e) {
        return { key: p.key, label: p.label, what: p.what, ok: false, detail: e instanceof Error ? e.message : "unreachable" };
      }
    }),
  );
  // Storage bucket for photos.
  try {
    const res = await fetch(`${url}/storage/v1/bucket/photos`, { headers, cache: "no-store" });
    items.push({ key: "photos", label: "Photo uploads", what: "the public photos bucket in Storage", ok: res.ok, detail: res.ok ? undefined : "bucket missing" });
  } catch {
    items.push({ key: "photos", label: "Photo uploads", what: "the public photos bucket in Storage", ok: false, detail: "unreachable" });
  }
  return { configured, writable, items, missing: items.filter((i) => !i.ok), checkedAt };
}

/** https://supabase.com/dashboard/project/<ref>/sql/new, from the project URL. */
export function sqlEditorUrl(): string | null {
  const url = dbConfig().url;
  const m = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? `https://supabase.com/dashboard/project/${m[1]}/sql/new` : null;
}
