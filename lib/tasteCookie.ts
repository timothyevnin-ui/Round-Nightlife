/** The cookie that carries a compact read of the person's taste to the results page. */
export const TASTE_COOKIE = "round_taste";

/** The person's first name, so the picker can say "Tim, we heard…". Set at sign-in, cleared at sign-out. */
export const NAME_COOKIE = "round_name";

export function setNameCookie(name: string | null | undefined) {
  if (typeof document === "undefined") return;
  const first = (name ?? "").trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{M}'’-]/gu, "").slice(0, 24) ?? "";
  try {
    document.cookie = `${NAME_COOKIE}=${encodeURIComponent(first)}; Path=/; Max-Age=${first ? 31536000 : 0}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** The person's favorite bar (one of ours, by slug), so the picker can lean toward rooms like it. */
export const FAV_COOKIE = "round_fav";

export function setFavCookie(slug: string | null | undefined) {
  if (typeof document === "undefined") return;
  const v = (slug ?? "").trim();
  const ok = /^[a-z0-9-]{1,60}$/.test(v) ? v : "";
  try {
    document.cookie = `${FAV_COOKIE}=${ok}; Path=/; Max-Age=${ok ? 31536000 : 0}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
