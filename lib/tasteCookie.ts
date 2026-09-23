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
