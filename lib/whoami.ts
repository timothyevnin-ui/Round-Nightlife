import "server-only";
import { dbConfig, keyHeaders } from "./db";

/**
 * Who is calling a server action? The browser holds the session (Supabase's
 * client keeps it in localStorage), so the client sends its access token
 * along and this asks Supabase Auth whom it belongs to. A bad, expired or
 * missing token simply means "anonymous"; nothing here ever throws.
 */
export async function whoami(token: string | undefined | null): Promise<{ id: string; name?: string } | null> {
  if (!token || token.length < 20 || token.length > 4096) return null;
  const { url, anon, configured } = dbConfig();
  if (!configured || !anon) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { ...keyHeaders(anon), Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    const u = (await res.json()) as { id?: string; user_metadata?: { name?: string } };
    if (!u.id || !/^[0-9a-f-]{36}$/i.test(u.id)) return null;
    return { id: u.id, name: typeof u.user_metadata?.name === "string" ? u.user_metadata.name : undefined };
  } catch {
    return null;
  }
}
