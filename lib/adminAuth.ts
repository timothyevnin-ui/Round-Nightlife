import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Back-office auth, deliberately simple: one PIN (ROUND_ADMIN_PIN) for the
 * founder, exchanged for a signed HttpOnly cookie. Swap for Supabase Auth
 * when there's more than one person in the back office.
 */

export const ADMIN_COOKIE = "round_admin";

export function adminPin() {
  return process.env.ROUND_ADMIN_PIN?.trim() || null;
}

export function signPin(pin: string) {
  return createHmac("sha256", pin).update("round-admin-v1").digest("hex");
}

export function pinMatches(candidate: string) {
  const pin = adminPin();
  if (!pin) return false;
  const a = Buffer.from(candidate.trim());
  const b = Buffer.from(pin);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const pin = adminPin();
  if (!pin) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const expected = signPin(pin);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
