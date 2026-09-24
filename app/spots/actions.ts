"use server";

import { cookies } from "next/headers";
import { dbConfig, getVenue } from "@/lib/db";
import { countDisputesToday, insertDispute } from "@/lib/disputes";
import { parseName } from "@/lib/taste";
import { NAME_COOKIE } from "@/lib/tasteCookie";
import { whoami } from "@/lib/whoami";
import { ABOUT_KEYS } from "@/lib/disputeAbouts";

export type DisagreeResult = { ok: true } | { ok: false; error: string };

/**
 * "Disagree with our take." Anyone can send one; it lands in Studio, where a
 * confirmed one is read into the place by the AI. Signed in, it's tied to the
 * account (and shows on their YOU page); otherwise the first name from the
 * cookie is all we keep. Soft cap: ten a day per person.
 */
export async function disagree(input: { slug: string; text: string; about?: string; token?: string; name?: string; website?: string }): Promise<DisagreeResult> {
  try {
    if (typeof input.website === "string" && input.website.trim()) return { ok: true }; // honeypot
    const slug = String(input.slug ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 80);
    const text = String(input.text ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!slug) return { ok: false, error: "Which place?" };
    if (text.replace(/\W/g, "").length < 6) return { ok: false, error: "Say a little more: what did we get wrong?" };
    if (!dbConfig().writable) return { ok: false, error: "We're not taking notes right this second. Try again in a bit." };
    const v = await getVenue(slug);
    if (!v || v.retired) return { ok: false, error: "That place isn't on ROUND." };
    const about = ABOUT_KEYS.includes(String(input.about)) ? String(input.about) : undefined;
    const me = await whoami(input.token);
    const jar = await cookies();
    const cookieName = parseName(jar.get(NAME_COOKIE)?.value);
    const fromName = (typeof input.name === "string" && input.name.trim().slice(0, 60)) || cookieName || undefined;
    if ((await countDisputesToday(me?.id, me ? undefined : fromName)) >= 10) return { ok: false, error: "That's plenty for one day. ROUND is reading them." };
    await insertDispute({ slug, text, about, fromName, userId: me?.id });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't send that." };
  }
}
