"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth, type About } from "@/lib/auth";
import { shrinkPhoto } from "@/lib/photo";
import { suggestPlaces, type PlaceSuggestion } from "@/app/you/actions";

/**
 * A few quick ones after sign-in, and the same screens behind "Edit" on YOU:
 * a photo, your favorite bar, your favorite restaurant, where you live.
 * Every one can be skipped; every answer saves as you go, so closing halfway
 * through loses nothing.
 */

type QKey = "photo" | "fav_bar" | "fav_restaurant" | "hometown";
const ORDER: QKey[] = ["photo", "fav_bar", "fav_restaurant", "hometown"];

export function AboutYou({ onDone, intro }: { onDone: () => void; intro?: boolean }) {
  const { profile, saveAbout, uploadAvatar } = useAuth();
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ORDER[i];
  const last = i === ORDER.length - 1;
  const next = () => {
    setError(null);
    if (last) onDone();
    else setI((k) => k + 1);
  };
  const save = async (patch: Partial<About>) => {
    setBusy(true);
    const err = await saveAbout(patch);
    setBusy(false);
    if (err) {
      setError(err);
      return false;
    }
    return true;
  };
  return (
    <div data-about-you data-step={key}>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{intro ? "A few quick ones" : "About you"}</p>
        <span className="text-[12px] font-medium" style={{ color: "var(--chalk-35)" }}>
          {i + 1} of {ORDER.length}
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {ORDER.map((k, n) => (
          <span key={k} className="block h-1 flex-1 rounded-full" style={{ background: n < i ? "var(--chalk)" : n === i ? "var(--tomato)" : "var(--chalk-20)" }} />
        ))}
      </div>
      {intro && i === 0 && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--chalk-55)" }}>
          So ROUND knows you, and your friends recognize you. Skip anything.
        </p>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }} transition={{ duration: 0.2 }}>
          {key === "photo" && <PhotoQ current={profile?.avatar_url ?? null} onSave={async (file) => { setBusy(true); const r = await uploadAvatar(file); if (r.url) await saveAbout({ avatar_url: r.url }); setBusy(false); if (r.error) { setError(r.error); return false; } return true; }} onNext={next} busy={busy} />}
          {key === "fav_bar" && <PlaceQ prompt="Favorite bar in the city?" placeholder="Start typing; we'll find it" kind="bar" initial={profile?.fav_bar ?? ""} onSave={(name, slug) => save({ fav_bar: name, fav_bar_slug: slug ?? null })} onNext={next} busy={busy} />}
          {key === "fav_restaurant" && <PlaceQ prompt="Favorite restaurant?" placeholder="Anywhere. Doesn't have to be on ROUND" kind="restaurant" initial={profile?.fav_restaurant ?? ""} onSave={(name) => save({ fav_restaurant: name })} onNext={next} busy={busy} />}
          {key === "hometown" && <TextQ prompt="Where do you live?" placeholder="Murray Hill, Williamsburg, Hoboken…" initial={profile?.hometown ?? ""} onSave={(v) => save({ hometown: v })} onNext={next} busy={busy} />}
        </motion.div>
      </AnimatePresence>
      {error && (
        <p className="mt-3 whitespace-pre-line text-[12.5px]" style={{ color: "var(--tomato)" }} role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button onClick={next} disabled={busy} className="pressable text-[13px] font-medium" style={{ color: "var(--chalk-35)" }} data-skip>
          {last ? "Skip this one" : "Skip"}
        </button>
        <button onClick={onDone} disabled={busy} className="pressable text-[13px] font-medium" style={{ color: "var(--chalk-55)" }} data-later>
          {intro ? "Later" : "Close"}
        </button>
      </div>
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return (
    <h2 className="serif mt-4" style={{ fontSize: 28, lineHeight: 1.05 }}>
      {text}
    </h2>
  );
}

const inputStyle = { height: 56, background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" } as const;

function NextButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="pressable btn-primary mt-4 flex h-13 w-full items-center justify-center text-[16px]" style={{ height: 52, opacity: disabled ? 0.55 : 1 }} data-next>
      {label}
    </button>
  );
}

function TextQ({ prompt, placeholder, initial, onSave, onNext, busy }: { prompt: string; placeholder: string; initial: string; onSave: (v: string) => Promise<boolean>; onNext: () => void; busy: boolean }) {
  const [v, setV] = useState(initial);
  const go = async () => {
    if (!v.trim()) return onNext();
    if (await onSave(v)) onNext();
  };
  return (
    <>
      <Prompt text={prompt} />
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder={placeholder}
        maxLength={80}
        className="mt-4 w-full rounded-[18px] border px-4 text-[17px] outline-none"
        style={inputStyle}
        data-about-input
      />
      <NextButton onClick={go} label={v.trim() ? (busy ? "Saving…" : "Next") : "Skip"} disabled={busy} />
    </>
  );
}

function PlaceQ({ prompt, placeholder, kind, initial, onSave, onNext, busy }: { prompt: string; placeholder: string; kind: "bar" | "restaurant"; initial: string; onSave: (name: string, slug?: string) => Promise<boolean>; onNext: () => void; busy: boolean }) {
  const [v, setV] = useState(initial);
  const [picked, setPicked] = useState<PlaceSuggestion | null>(null);
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const seq = useRef(0);
  // Suggestions arrive a beat after typing stops; an older answer never overwrites a newer one.
  const lookup = (q: string) => {
    const mine = ++seq.current;
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    window.setTimeout(async () => {
      if (mine !== seq.current) return;
      const r = await suggestPlaces(q.trim(), kind).catch(() => []);
      if (mine === seq.current) setHits(r);
    }, 220);
  };
  const go = async () => {
    if (!v.trim()) return onNext();
    if (await onSave(v, picked?.name === v.trim() ? picked.slug : undefined)) onNext();
  };
  return (
    <>
      <Prompt text={prompt} />
      <input
        autoFocus
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setPicked(null);
          lookup(e.target.value);
        }}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder={placeholder}
        maxLength={80}
        className="mt-4 w-full rounded-[18px] border px-4 text-[17px] outline-none"
        style={inputStyle}
        data-about-input
      />
      {hits.length > 0 && !picked && (
        <ul className="mt-2 overflow-hidden rounded-[16px] border" style={{ borderColor: "var(--hairline)" }} data-suggestions>
          {hits.map((h) => (
            <li key={h.slug}>
              <button
                onClick={() => {
                  setPicked(h);
                  setV(h.name);
                  setHits([]);
                }}
                className="pressable flex w-full items-center justify-between px-4 py-2.5 text-left"
              >
                <span className="text-[15px] font-medium">{h.name}</span>
                <span className="text-[12px]" style={{ color: "var(--chalk-35)" }}>
                  {h.where}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--pine, #2e6b52)" }} data-picked>
          On ROUND. Your picks will lean that way.
        </p>
      )}
      <NextButton onClick={go} label={v.trim() ? (busy ? "Saving…" : "Next") : "Skip"} disabled={busy} />
    </>
  );
}

function PhotoQ({ current, onSave, onNext, busy }: { current: string | null; onSave: (file: File) => Promise<boolean>; onNext: () => void; busy: boolean }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [file, setFile] = useState<File | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const choose = async (f: File | undefined) => {
    if (!f) return;
    const small = await shrinkPhoto(f, 640, 0.85);
    setFile(small);
    setPreview(URL.createObjectURL(small));
  };
  const go = async () => {
    if (!file) return onNext();
    if (await onSave(file)) onNext();
  };
  return (
    <>
      <Prompt text="Add a photo?" />
      <div className="mt-4 flex items-center gap-4">
        <button onClick={() => ref.current?.click()} className="pressable relative h-24 w-24 shrink-0 overflow-hidden rounded-full border" style={{ borderColor: "var(--hairline-strong)", background: "rgba(22,33,58,0.05)" }} aria-label="Choose a photo" data-photo-button>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
              <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6h6.4L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug" style={{ color: "var(--chalk-55)" }}>
            Friends see it next to your name. Nobody else does.
          </p>
          <button onClick={() => ref.current?.click()} className="pressable btn-ghost mt-2 h-10 px-4 text-[13.5px]">
            {preview ? "Change" : "Choose a photo"}
          </button>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} data-photo-input />
      <NextButton onClick={go} label={file ? (busy ? "Uploading…" : "Next") : "Skip"} disabled={busy} />
    </>
  );
}

/** Round face, or the first letter. */
export function Avatar({ url, name, size = 44 }: { url?: string | null; name?: string | null; size?: number }) {
  // A photo that won't load (a storage bucket that isn't public, an old upload) becomes the initial, never a broken-image icon.
  const [broken, setBroken] = useState<string | null>(null);
  return url && broken !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, background: "rgba(43,77,255,0.12)" }} onError={() => setBroken(url)} data-avatar />
  ) : (
    <span className="serif flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, fontSize: size * 0.45, background: "rgba(43,77,255,0.22)", color: "var(--chalk)" }} data-avatar-initial>
      {(name ?? "?").trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
