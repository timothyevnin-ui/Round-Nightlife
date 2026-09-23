"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { accountsEnabled, getSupabase } from "./supabase";
import { clearPersonal, mergeState, readState, setRemote } from "./store";
import { setFavCookie, setNameCookie } from "./tasteCookie";
import { makeRemote, pullAll, pushAll } from "./sync";

/**
 * Accounts. Phone number in, six-digit code back, a name and a birthday the
 * first time. Nothing in ROUND requires an account; this exists so what you
 * save follows you from phone to phone.
 */

export type Profile = {
  id: string;
  name: string;
  birthday: string | null;
  phone: string | null;
  is_public?: boolean;
  share_location?: boolean;
  /** About you (V14): all optional, all skippable. */
  hometown?: string | null;
  fav_bar?: string | null;
  fav_bar_slug?: string | null;
  fav_restaurant?: string | null;
  fun?: Record<string, string> | null;
  avatar_url?: string | null;
};

/** The about-you fields a person can edit. */
export type About = Pick<Profile, "hometown" | "fav_bar" | "fav_bar_slug" | "fav_restaurant" | "fun" | "avatar_url">;
const ABOUT_COLUMNS = "hometown,fav_bar,fav_bar_slug,fav_restaurant,fun,avatar_url";

export type SignInReason = "keep" | "you" | "rate" | "menu" | "friends";

export type AuthState = {
  /** False when the app runs without a database: every sign-in surface hides itself. */
  enabled: boolean;
  /** True once we know whether there's a session. */
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  /** Signed in, but the name/birthday step hasn't been finished. */
  needsProfile: boolean;
  sheetOpen: boolean;
  reason: SignInReason;
  openSignIn: (reason?: SignInReason) => void;
  closeSignIn: () => void;
  sendCode: (phone: string) => Promise<string | null>;
  verifyCode: (phone: string, code: string) => Promise<string | null>;
  saveProfile: (p: { name: string; birthday: string }) => Promise<string | null>;
  /** Save any of the about-you fields. */
  saveAbout: (patch: Partial<About>) => Promise<string | null>;
  /** Upload a profile photo (already shrunk) and return its public URL, or an error. */
  uploadAvatar: (file: File) => Promise<{ url?: string; error?: string }>;
  signOut: (opts?: { forget?: boolean }) => Promise<void>;
  /** Reflect a profile change made elsewhere (privacy toggles) without a refetch. */
  updateProfile: (patch: Partial<Profile>) => void;
};

const Ctx = createContext<AuthState | null>(null);

const SKIP_KEY = "round:signin-skipped";

/** Has the person dismissed the sheet this session? Then don't auto-open it again. */
export function signInSkipped() {
  try {
    return window.sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // `enabled` comes from env (same on server and client, so no hydration
  // mismatch); the client itself only exists in the browser.
  const enabled = accountsEnabled();
  const sb = useMemo(() => getSupabase(), []);
  const [ready, setReady] = useState(!enabled);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reason, setReason] = useState<SignInReason>("keep");
  const mergedFor = useRef<string | null>(null);

  const loadProfile = useCallback(
    async (u: User): Promise<Profile | null> => {
      if (!sb) return null;
      // The privacy columns arrived in V8; read without them if the database is behind.
      let data: Profile | null = null;
      const v14 = await sb.from("profiles").select(`id,name,birthday,phone,is_public,share_location,${ABOUT_COLUMNS}`).eq("id", u.id).maybeSingle();
      if (!v14.error) data = (v14.data as Profile | null) ?? null;
      else {
        const full = await sb.from("profiles").select("id,name,birthday,phone,is_public,share_location").eq("id", u.id).maybeSingle();
        if (!full.error) data = (full.data as Profile | null) ?? null;
        else {
          const basic = await sb.from("profiles").select("id,name,birthday,phone").eq("id", u.id).maybeSingle();
          data = (basic.data as Profile | null) ?? null;
        }
      }
      if (data) return data;
      // First sign-in: start the row now (phone only) so the person exists in
      // the Studio even if they never finish the name step.
      const phone = u.phone ? `+${u.phone.replace(/^\+/, "")}` : null;
      const { data: made } = await sb.from("profiles").upsert({ id: u.id, name: "", phone }, { onConflict: "id" }).select("id,name,birthday,phone").maybeSingle();
      return (made as Profile | null) ?? { id: u.id, name: "", birthday: null, phone };
    },
    [sb],
  );

  /** Once per sign-in: this phone's history goes up, the account's comes down. */
  const merge = useCallback(
    async (u: User) => {
      if (!sb || mergedFor.current === u.id) return;
      mergedFor.current = u.id;
      try {
        await pushAll(sb, u.id, readState());
        mergeState(await pullAll(sb, u.id));
      } catch (e) {
        console.warn("[auth] merge failed", e);
        mergedFor.current = null;
      }
    },
    [sb],
  );

  const apply = useCallback(
    async (session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      setRemote(makeRemote(sb!, u?.id ?? null));
      if (u) {
        const p = await loadProfile(u);
        setProfile(p);
        setNameCookie(p?.name);
        setFavCookie(p?.fav_bar_slug);
        await merge(u);
      } else {
        setProfile(null);
        setNameCookie(null);
        mergedFor.current = null;
      }
      setReady(true);
    },
    [sb, loadProfile, merge],
  );

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    sb.auth.getSession().then(({ data }) => {
      if (!cancelled) apply(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      // Deferred: supabase-js holds a lock while this callback runs, and
      // apply() makes database calls of its own.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") window.setTimeout(() => apply(session), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [sb, apply]);

  const openSignIn = useCallback((r: SignInReason = "keep") => {
    setReason(r);
    setSheetOpen(true);
  }, []);

  const closeSignIn = useCallback(() => {
    setSheetOpen(false);
    try {
      window.sessionStorage.setItem(SKIP_KEY, "1");
    } catch {}
  }, []);

  const sendCode = useCallback(
    async (phone: string) => {
      if (!sb) return "Accounts aren't switched on yet.";
      const { error } = await sb.auth.signInWithOtp({ phone, options: { channel: "sms" } });
      return error ? friendly(error.message, "send") : null;
    },
    [sb],
  );

  const verifyCode = useCallback(
    async (phone: string, code: string) => {
      if (!sb) return "Accounts aren't switched on yet.";
      const { data, error } = await sb.auth.verifyOtp({ phone, token: code, type: "sms" });
      if (error) return friendly(error.message, "verify");
      if (data.session) await apply(data.session);
      return null;
    },
    [sb, apply],
  );

  const saveProfile = useCallback(
    async ({ name, birthday }: { name: string; birthday: string }) => {
      if (!sb || !user) return "You're not signed in.";
      const row = { id: user.id, name: name.trim(), birthday, phone: user.phone ? `+${user.phone.replace(/^\+/, "")}` : null };
      const { error } = await sb.from("profiles").upsert(row, { onConflict: "id" });
      if (error) return friendly(error.message, "profile");
      setProfile((p) => ({ ...(p ?? {}), ...row }));
      setNameCookie(row.name);
      return null;
    },
    [sb, user],
  );

  const signOut = useCallback(async (opts?: { forget?: boolean }) => {
    if (!sb) return;
    // Under 21: they never had an account here. Remove the row started at sign-in.
    if (opts?.forget && user) await sb.from("profiles").delete().eq("id", user.id);
    await sb.auth.signOut();
    clearPersonal();
    setNameCookie(null);
    setFavCookie(null);
    setUser(null);
    setProfile(null);
    setRemote(makeRemote(sb, null));
    mergedFor.current = null;
  }, [sb, user]);

  const saveAbout = useCallback(
    async (patch: Partial<About>) => {
      if (!sb || !user) return "You're not signed in.";
      const clean: Partial<About> = {};
      for (const k of ["hometown", "fav_bar", "fav_bar_slug", "fav_restaurant", "avatar_url"] as const) {
        if (k in patch) clean[k] = typeof patch[k] === "string" ? (patch[k] as string).trim().slice(0, 120) || null : null;
      }
      if ("fun" in patch) clean.fun = patch.fun ?? {};
      const { error } = await sb.from("profiles").update(clean).eq("id", user.id);
      if (error) return /column|schema cache/i.test(error.message) ? "The database is a version behind: run the latest schema.sql in Supabase, then try again." : friendly(error.message, "profile");
      setProfile((p) => (p ? { ...p, ...clean } : p));
      if ("fav_bar_slug" in clean) setFavCookie(clean.fav_bar_slug);
      return null;
    },
    [sb, user],
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<{ url?: string; error?: string }> => {
      if (!sb || !user) return { error: "You're not signed in." };
      const path = `${user.id}/avatar.jpg`;
      const { error } = await sb.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg", cacheControl: "3600" });
      if (error) return { error: /bucket/i.test(error.message) ? "Photos aren't switched on yet: run the latest schema.sql in Supabase (it creates the avatars bucket)." : `Couldn't upload that photo.\n${error.message}` };
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      return { url: `${data.publicUrl}?v=${Date.now()}` };
    },
    [sb, user],
  );

  const updateProfile = useCallback((patch: Partial<Profile>) => setProfile((p) => (p ? { ...p, ...patch } : p)), []);

  const needsProfile = !!user && (!profile || !profile.name || !profile.birthday);

  const value = useMemo<AuthState>(
    () => ({ enabled, ready, user, profile, needsProfile, sheetOpen, reason, openSignIn, closeSignIn, sendCode, verifyCode, saveProfile, saveAbout, uploadAvatar, signOut, updateProfile }),
    [enabled, ready, user, profile, needsProfile, sheetOpen, reason, openSignIn, closeSignIn, sendCode, verifyCode, saveProfile, saveAbout, uploadAvatar, signOut, updateProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const OFF: AuthState = {
  enabled: false,
  ready: true,
  user: null,
  profile: null,
  needsProfile: false,
  sheetOpen: false,
  reason: "keep",
  openSignIn: () => {},
  closeSignIn: () => {},
  sendCode: async () => "Accounts aren't switched on yet.",
  verifyCode: async () => "Accounts aren't switched on yet.",
  saveProfile: async () => "Accounts aren't switched on yet.",
  saveAbout: async () => "Accounts aren't switched on yet.",
  uploadAvatar: async () => ({ error: "Accounts aren't switched on yet." }),
  signOut: async () => {},
  updateProfile: () => {},
};

export function useAuth(): AuthState {
  return useContext(Ctx) ?? OFF;
}

/**
 * Supabase's messages are for developers; these are for people. The original
 * rides along after a newline, shown in small print, so a setup problem
 * (wrong Twilio token, geo block, rate limit) can be read off the screen.
 */
function friendly(msg: string, stage: "send" | "verify" | "profile"): string {
  return `${nice(msg, stage)}\n${msg}`;
}

function nice(msg: string, stage: "send" | "verify" | "profile"): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("max send attempts")) return "Too many tries. Give it a minute and try again.";
  if (m.includes("signups not allowed")) return "New sign-ups are paused for the moment.";
  if (stage === "verify") {
    if (m.includes("expired") && !m.includes("invalid")) return "That code expired. Tap resend for a new one.";
    return "That code didn't match. Check the text and try again, or resend.";
  }
  if (stage === "send") {
    if (m.includes("phone number") && (m.includes("invalid") || m.includes("format"))) return "That doesn't look like a phone number we can text.";
    return "Couldn't send the text right now.";
  }
  return "Couldn't save that. Try again.";
}
