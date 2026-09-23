"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { RealMap } from "@/components/RealMap";
import { TypedHeading, useTypewriter } from "@/components/QuickOnes";
import { HoursEditor } from "@/components/admin/HoursEditor";
import { ScoreBadge } from "@/components/Score";
import { fillFromWeb, lookupAddress, nextQuestion, saveVenue, type SavePayload } from "@/app/admin/actions";
import { SUGGESTED_TAGS } from "@/lib/attrs";
import { weekSummary } from "@/lib/hours";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import { shrinkPhoto } from "@/lib/photo";
import { applyRecAnswer, type RecQuestion } from "@/lib/recommendQuestions";
import { slugify } from "@/lib/slug";
import type { SuggestionAnswers } from "@/lib/suggestions";
import type { Attrs, Hours, NeighborhoodId } from "@/lib/types";

/**
 * Add a place the way the app asks people about their night: one question at
 * a time, typed out, a couple of buttons. Every answer lands in the same
 * fields the full form edits, so the algorithm sees exactly what it would
 * have seen from the form; this is just a nicer way in. Anything can still be
 * changed in the editor afterwards.
 */

type Step = "name" | "where" | "kind" | "food" | "words" | "quick" | "hours" | "day" | "says" | "catch" | "score" | "been" | "photo" | "done";
const ORDER: Step[] = ["name", "where", "kind", "food", "words", "quick", "hours", "day", "says", "catch", "score", "been", "photo", "done"];

const CUISINES = ["Italian", "Mexican", "Tacos", "Burgers", "Pizza", "Cheesesteaks", "Wings", "Sushi", "Oysters", "Steak", "French", "Thai", "Chinese", "Korean", "Bar snacks"];

export function AddFlow({ writable }: { writable: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [hood, setHood] = useState<NeighborhoodId | undefined>();
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookNote, setLookNote] = useState<string | null>(null);
  // Type an address and, a beat later, ROUND finds it: the pin lands and the neighborhood picks itself.
  useEffect(() => {
    const q = address.trim();
    if (q.length < 8 || pin?.label === q) return;
    const t = window.setTimeout(async () => {
      setLooking(true);
      const r = await lookupAddress(q);
      setLooking(false);
      if ("error" in r) return setLookNote(r.error);
      setPin({ lat: r.lat, lng: r.lng, label: q });
      if (r.neighborhood) {
        setHood(r.neighborhood);
        setLookNote(`Found it: ${neighborhoodName(r.neighborhood)}. Pin set.`);
      } else setLookNote("Found it, but it's outside the neighborhoods ROUND covers. Pick the nearest one.");
    }, 700);
    return () => window.clearTimeout(t);
  }, [address, pin?.label]);
  const [kind, setKind] = useState<"bar" | "kitchen" | "restaurant">("bar");
  const [cuisine, setCuisine] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [answers, setAnswers] = useState<SuggestionAnswers>({});
  const [hours, setHours] = useState<Hours | undefined>();
  const [daytime, setDaytime] = useState<boolean | null>(null);
  const [dayDeal, setDayDeal] = useState("");
  const [site, setSite] = useState("");
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [take, setTake] = useState("");
  const [theCatch, setTheCatch] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  const idx = ORDER.indexOf(step);
  const next = () => {
    let n = ORDER[idx + 1];
    if (n === "food" && kind === "bar") n = "words"; // drinks-only: no cuisine question
    setStep(n);
  };
  const back = () => {
    let p = ORDER[idx - 1];
    if (p === "food" && kind === "bar") p = "kind";
    if (p) setStep(p);
  };

  const readSite = async () => {
    if (!site.trim()) return;
    setReading(true);
    setReadNote(null);
    const r = await fillFromWeb({ url: site, name, address });
    setReading(false);
    if (r.error || !r.fill) return setReadNote(r.error ?? "Nothing found.");
    const found: string[] = [];
    if (r.fill.hours) {
      setHours(r.fill.hours);
      found.push(`hours (${weekSummary(r.fill.hours)})`);
    }
    if (r.fill.cuisine && !cuisine) {
      setCuisine(r.fill.cuisine);
      found.push(`food: ${r.fill.cuisine}`);
    }
    if (r.fill.barFood === true && kind === "bar") {
      setKind("kitchen");
      found.push("it has a kitchen");
    }
    setReadNote(found.length ? `Got ${found.join(", ")}.` : `Read the page but it doesn't post hours. ${r.fill.summary ?? ""}`);
  };

  const pickPhoto = async (f: File | null) => {
    if (!f) return;
    const small = await shrinkPhoto(f).catch(() => f);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
  };

  const payload = useMemo<SavePayload>(() => {
    const big = answers.groupBig;
    const date = answers.dateFit;
    return {
      name: name.trim(),
      kind: kind === "restaurant" ? "restaurant" : "bar",
      barFood: kind === "kitchen",
      cuisine: kind === "bar" ? "" : cuisine,
      neighborhood: hood ?? "",
      address: address.trim(),
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      take: take.trim(),
      theCatch: theCatch.trim() || undefined,
      tags,
      attrs: { ...(answers.attrs ?? {}), ...(daytime === null ? {} : { daytime: daytime ? 0.9 : 0.1 }) } as Partial<Attrs>,
      dayDeal,
      groupFit: typeof big === "number" ? { two: 0.6, small: 0.75, mid: big >= 0.5 ? 0.75 : 0.45, big } : { two: 0.7, small: 0.7, mid: 0.5, big: 0.3 },
      dateFit: typeof date === "number" ? { first: date, early: date, longterm: Math.max(0.5, date) } : { first: 0.5, early: 0.5, longterm: 0.5 },
      price: answers.price ?? 2,
      capacity: answers.capacity ?? "medium",
      easyIn: answers.easyIn ?? 0.5,
      bestWindows: [],
      verified,
      hours: hours ?? null,
      score,
      readTags: true,
      notes: answers.said?.length ? `Answered in Studio: ${answers.said.join(" · ")}.` : undefined,
    };
  }, [name, kind, cuisine, hood, address, pin, take, theCatch, tags, answers, verified, hours, score, daytime, dayDeal]);

  const save = async () => {
    if (!writable) return setError("Connect Supabase first (SUPABASE.md); nothing can be saved yet.");
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    if (photo) fd.set("photo", photo, photo.name);
    const r = await saveVenue(fd);
    setSaving(false);
    if (!r.ok) return setError(r.error);
    setSavedSlug(r.slug);
    setStep("done");
  };

  const answered = answers.said?.length ?? 0;

  return (
    <main className="screen flex flex-col pb-16" style={{ minHeight: "100dvh" }}>
      <header className="flex items-center justify-between pt-4 pb-2">
        {step === "name" || step === "done" ? (
          <Link href="/admin" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back to Studio">
            <Chevron />
          </Link>
        ) : (
          <button onClick={back} className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
            <Chevron />
          </button>
        )}
        <span className="eyebrow">Add a place</span>
        <Link href="/admin/new" className="pressable text-[12.5px] font-medium" style={{ color: "var(--chalk-55)" }}>
          The full form
        </Link>
      </header>

      {step !== "done" && (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--ink-6)" }}>
          <div className="h-1 rounded-full transition-all" style={{ width: `${((idx + 1) / (ORDER.length - 1)) * 100}%`, background: "var(--tomato)" }} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "name" && (
          <Screen key="name">
            <Prompt text="What's it called?" />
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="The Red Lion" className="mt-6 w-full rounded-[18px] border px-4 text-[20px] outline-none" style={{ height: 60, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} onKeyDown={(e) => e.key === "Enter" && name.trim() && next()} />
            <NextButton onClick={next} disabled={!name.trim()} />
          </Screen>
        )}

        {step === "where" && (
          <Screen key="where">
            <Prompt text="Where is it?" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address (151 Bleecker St)" autoComplete="street-address" className="mt-5 w-full rounded-[16px] border px-4 text-[15px] outline-none" style={{ height: 52, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} data-address />
            <p className="mt-2 min-h-[18px] text-[12px]" style={{ color: lookNote && /^Found it:/.test(lookNote) ? "var(--pine)" : "var(--chalk-35)" }} data-look-note aria-live="polite">
              {looking ? "Finding it…" : lookNote ?? "Type the address and ROUND finds the neighborhood and drops the pin."}
            </p>
            <div className="mt-3 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--hairline)", background: "var(--paper-2)" }}>
              <RealMap value={hood} onSelect={setHood} height={250} pin={pin} />
            </div>
            <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
              {NEIGHBORHOODS.map((n) => (
                <button key={n.id} onClick={() => setHood(n.id)} aria-pressed={hood === n.id} className="pressable flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium" style={hood === n.id ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline)" }}>
                  {n.short}
                </button>
              ))}
            </div>
            <NextButton onClick={next} disabled={!hood} label={hood ? `It's in ${neighborhoodName(hood)}` : "Pick a neighborhood"} />
          </Screen>
        )}

        {step === "kind" && (
          <Screen key="kind">
            <Prompt text="Bar or restaurant?" />
            <div className="mt-8 grid gap-3">
              {(
                [
                  ["bar", "A bar", "Drinks. Maybe a bowl of nuts."],
                  ["kitchen", "A bar with a kitchen", "Real food, but you came for the bar."],
                  ["restaurant", "A restaurant", "You came to eat; the drinks are good too."],
                ] as const
              ).map(([k, label, sub]) => (
                <button
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setStep(k === "bar" ? "words" : "food");
                  }}
                  className="pressable flex items-center justify-between rounded-[20px] border px-5 py-4 text-left"
                  style={kind === k ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", borderColor: "var(--hairline-strong)" }}
                >
                  <span>
                    <span className="serif block" style={{ fontSize: 22, lineHeight: 1.1 }}>
                      {label}
                    </span>
                    <span className="block text-[12.5px] opacity-70">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </Screen>
        )}

        {step === "food" && (
          <Screen key="food">
            <Prompt text="What kind of food?" />
            <div className="mt-6 flex flex-wrap gap-2">
              {[...new Set([...(cuisine && !CUISINES.includes(cuisine) ? [cuisine] : []), ...CUISINES])].map((c) => (
                <button key={c} onClick={() => setCuisine(c)} className="pressable h-10 rounded-full border px-3.5 text-[14px] font-medium" style={cuisine === c ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }}>
                  {c}
                </button>
              ))}
            </div>
            <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Or type it" className="mt-4 w-full rounded-[16px] border px-4 text-[15px] outline-none" style={{ height: 52, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
            <NextButton onClick={next} label={cuisine.trim() ? "Next" : "Skip"} ghost={!cuisine.trim()} />
          </Screen>
        )}

        {step === "words" && (
          <Screen key="words">
            <Prompt text="Three words for it?" />
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-55)" }}>
              The keywords under the name. Pick a few or type your own.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[...new Set([...tags, ...SUGGESTED_TAGS])].map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== t) : cur.length >= 5 ? cur : [...cur, t]))} aria-pressed={on} className="pressable h-10 rounded-full border px-3.5 text-[13.5px] font-medium" style={on ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }}>
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Your own word"
                className="h-12 flex-1 rounded-[16px] border px-4 text-[15px] outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customTag.trim()) {
                    setTags((cur) => (cur.includes(customTag.trim()) || cur.length >= 5 ? cur : [...cur, customTag.trim()]));
                    setCustomTag("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (!customTag.trim()) return;
                  setTags((cur) => (cur.includes(customTag.trim()) || cur.length >= 5 ? cur : [...cur, customTag.trim()]));
                  setCustomTag("");
                }}
                className="pressable btn-ghost h-12 px-4 text-[14px]"
              >
                Add
              </button>
            </div>
            <NextButton onClick={next} label={tags.length ? "Next" : "Skip"} ghost={!tags.length} />
          </Screen>
        )}

        {step === "quick" && (
          <Screen key="quick">
            <Quick place={{ name, kind: kind === "restaurant" ? "restaurant" : "bar", barFood: kind === "kitchen", cuisine, tags }} answers={answers} onChange={setAnswers} onDone={next} />
          </Screen>
        )}

        {step === "hours" && (
          <Screen key="hours">
            <Prompt text="Hours?" />
            <div className="mt-5 flex gap-2">
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Paste the website, I'll read the hours" className="h-12 flex-1 rounded-[16px] border px-4 text-[14px] outline-none" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
              <button onClick={readSite} disabled={reading || !site.trim()} className="pressable btn-ghost h-12 px-4 text-[14px]" style={{ opacity: reading || !site.trim() ? 0.5 : 1 }}>
                {reading ? "Reading…" : "Read it"}
              </button>
            </div>
            {readNote && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--ink-70)" }}>
                {readNote}
              </p>
            )}
            <div className="mt-5">
              <HoursEditor value={hours} onChange={setHours} />
            </div>
            <NextButton onClick={next} label={hours ? "Next" : "Don't know yet, skip"} ghost={!hours} />
          </Screen>
        )}

        {step === "day" && (
          <Screen key="day">
            <Prompt text="Good during the day?" />
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-55)" }}>
              Saturday at 2pm, would you send someone here? Sun, a game, a deal, a long afternoon.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setDaytime(true)} className="pressable flex h-16 items-center justify-center rounded-full border text-[17px] font-semibold" style={daytime === true ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", borderColor: "var(--hairline-strong)" }}>
                Yes
              </button>
              <button onClick={() => setDaytime(false)} className="pressable flex h-16 items-center justify-center rounded-full border text-[17px] font-semibold" style={daytime === false ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", borderColor: "var(--hairline-strong)" }}>
                Night only
              </button>
            </div>
            {daytime && (
              <input value={dayDeal} onChange={(e) => setDayDeal(e.target.value)} placeholder="Any day deal? ($5 pitchers till 6)" className="mt-4 w-full rounded-[16px] border px-4 text-[15px] outline-none" style={{ height: 52, background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} data-day-deal-input />
            )}
            <NextButton onClick={next} label={daytime === null ? "Not sure, skip" : "Next"} ghost={daytime === null} />
          </Screen>
        )}

        {step === "says" && (
          <Screen key="says">
            <Prompt text="ROUND says…" />
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-55)" }}>
              Your words, the way you&apos;d say it to a friend. This sits right under the photo.
            </p>
            <textarea autoFocus value={take} onChange={(e) => setTake(e.target.value)} rows={5} placeholder="What a spot. Saw Karl-Anthony Towns there once. Great to have a beer and watch a game…" className="mt-5 w-full resize-none rounded-[18px] border px-4 py-3 text-[17px] leading-snug outline-none" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
            <NextButton onClick={next} disabled={take.trim().length < 12} label="Next" />
          </Screen>
        )}

        {step === "catch" && (
          <Screen key="catch">
            <Prompt text="Any heads up?" />
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-55)" }}>
              The thing Maps doesn&apos;t know: the line, the cover, the night to avoid, what to order. One line. Optional.
            </p>
            <textarea value={theCatch} onChange={(e) => setTheCatch(e.target.value)} rows={3} placeholder="Eagles Sundays are standing room only…" className="mt-5 w-full resize-none rounded-[18px] border px-4 py-3 text-[16px] leading-snug outline-none" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }} />
            <NextButton onClick={next} label={theCatch.trim() ? "Next" : "Skip"} ghost={!theCatch.trim()} />
          </Screen>
        )}

        {step === "score" && (
          <Screen key="score">
            <Prompt text="ROUND's score?" />
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-55)" }}>
              How much we like it, out of 100. Shows next to ROUND says. Skip it and no score shows.
            </p>
            <div className="mt-8 flex items-center gap-5">
              <ScoreBadge score={score ?? undefined} size={84} />
              {score === null && (
                <span className="serif" style={{ fontSize: 40, color: "var(--ink-20)" }}>
                  —
                </span>
              )}
              <div className="flex-1">
                <input type="range" min={0} max={100} value={score ?? 75} onChange={(e) => setScore(Number(e.target.value))} className="w-full" style={{ accentColor: "var(--tomato)" }} aria-label="ROUND's score" />
                <div className="mt-1 flex justify-between text-[11px]" style={{ color: "var(--ink-35)" }}>
                  <span>Skip it</span>
                  <span>A perfect night</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[60, 70, 80, 88, 94].map((n) => (
                <button key={n} onClick={() => setScore(n)} className="pressable h-9 rounded-full border px-3 text-[13px] font-medium" style={score === n ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)" }}>
                  {n}
                </button>
              ))}
            </div>
            <NextButton onClick={next} label={score === null ? "No score yet, skip" : `Score it ${score}`} ghost={score === null} />
          </Screen>
        )}

        {step === "been" && (
          <Screen key="been">
            <Prompt text="Have you been?" />
            <p className="mt-2 text-[13px]" style={{ color: "var(--ink-55)" }}>
              Yes means the check goes next to the name: verified by ROUND. Our opinion only counts with the check on it.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setVerified(true);
                  next();
                }}
                className="pressable btn-primary flex h-16 items-center justify-center text-[17px]"
              >
                Yes, verified
              </button>
              <button
                onClick={() => {
                  setVerified(false);
                  next();
                }}
                className="pressable btn-ghost flex h-16 items-center justify-center text-[17px]"
              >
                Not yet
              </button>
            </div>
          </Screen>
        )}

        {step === "photo" && (
          <Screen key="photo">
            <Prompt text="Got a photo?" />
            <label className="mt-6 block overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }}>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="aspect-[16/10] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/10] w-full items-center justify-center text-[15px]" style={{ color: "var(--ink-55)" }}>
                  Tap to pick a photo
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
            </label>
            {error && (
              <p className="mt-3 text-[13.5px]" style={{ color: "var(--tomato-deep)" }}>
                {error}
              </p>
            )}
            <button onClick={save} disabled={saving} className="pressable btn-primary mt-6 flex h-14 w-full items-center justify-center text-[16px]" style={{ opacity: saving ? 0.6 : 1 }} data-save>
              {saving ? "Saving…" : photo ? `Save ${name.trim()}` : `Save without a photo`}
            </button>
            <p className="mt-3 text-center text-[12px]" style={{ color: "var(--ink-35)" }}>
              {answered ? `${answered} questions answered` : "No questions answered"} · {hours ? "hours set" : "no hours"} · {verified ? "verified" : "unverified"}
            </p>
          </Screen>
        )}

        {step === "done" && (
          <Screen key="done">
            <Prompt text={`${name.trim()} is on ROUND.`} />
            <p className="mt-3 text-[15px]" style={{ color: "var(--ink-70)" }}>
              Live within a minute. {verified ? "The check is on it." : "Flip Verified once you've been."}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href={`/v/${savedSlug ?? slugify(name)}`} className="pressable btn-primary flex h-14 items-center justify-center text-[16px]">
                See the page
              </Link>
              <Link href={`/admin/v/${savedSlug ?? slugify(name)}`} className="pressable btn-ghost flex h-12 items-center justify-center text-[15px]">
                Edit anything
              </Link>
              <button onClick={() => router.refresh()} className="pressable text-[14px] font-medium" style={{ color: "var(--ink-55)" }}>
                <Link href="/admin/add">Add another</Link>
              </button>
            </div>
          </Screen>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ───────────────────────── the quick ones: Claude asks, one at a time ───────────────────────── */

type Place = { name: string; kind: "bar" | "restaurant"; barFood: boolean; cuisine: string; tags: string[] };

function Quick({ place, answers, onChange, onDone }: { place: Place; answers: SuggestionAnswers; onChange: (a: SuggestionAnswers) => void; onDone: () => void }) {
  const [q, setQ] = useState<RecQuestion | null>(null);
  const [source, setSource] = useState<"claude" | "bank">("bank");
  const [loading, setLoading] = useState(true);
  const [asked, setAsked] = useState(0);
  const [finished, setFinished] = useState(false);

  const ask = async (current: SuggestionAnswers, n: number) => {
    setLoading(true);
    const r = await nextQuestion({ name: place.name, kind: place.kind, barFood: place.barFood, cuisine: place.cuisine, tags: place.tags, said: current.said ?? [], asked: n, attrs: current.attrs ?? {} });
    setLoading(false);
    setSource(r.source);
    if (r.done || !r.question) {
      setFinished(true);
      window.setTimeout(onDone, 500);
      return;
    }
    setQ(r.question);
  };
  // First question, once the screen is up (the cleanup keeps dev's double-mount to one ask).
  useEffect(() => {
    const t = window.setTimeout(() => void ask(answers, 0), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (k: number) => {
    if (!q) return;
    const next = applyRecAnswer(answers, q, k);
    onChange(next);
    setQ(null);
    setAsked(asked + 1);
    void ask(next, asked + 1);
  };
  const skip = () => {
    if (!q) return;
    const next: SuggestionAnswers = { ...answers, said: [...(answers.said ?? []), `${q.prompt} (skipped)`] };
    onChange(next);
    setQ(null);
    setAsked(asked + 1);
    void ask(next, asked + 1);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{source === "claude" ? "Claude is asking · this is the algorithm" : "The quick ones · this is the algorithm"}</p>
        <span className="text-[12px] font-medium" style={{ color: "var(--ink-35)" }}>
          {asked + 1} of ~{place.kind === "restaurant" ? 9 : 10}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif text-center" style={{ fontSize: 34 }}>
              Got it.
            </motion.p>
          ) : q ? (
            <Q key={q.id + asked} prompt={q.prompt} labels={q.options.map((o) => o.label)} onPick={pick} />
          ) : (
            <motion.p key={`thinking-${asked}`} initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} className="serif" style={{ fontSize: 30, minHeight: "2.1em" }} aria-live="polite">
              {loading ? "…" : ""}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={skip} disabled={!q} className="pressable text-[13px] font-medium" style={{ color: "var(--ink-35)" }}>
          Not sure, skip
        </button>
        <button onClick={onDone} className="pressable btn-ghost flex h-11 items-center px-5 text-[14px]">
          That&apos;s enough
        </button>
      </div>
    </div>
  );
}

function Q({ prompt, labels, onPick }: { prompt: string; labels: string[]; onPick: (k: number) => void }) {
  const typed = useTypewriter(prompt);
  const ready = typed.length >= prompt.length;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }}>
      <TypedHeading text={prompt} typed={typed} ready={ready} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 8 }} transition={{ duration: 0.25 }} className={`mt-8 grid gap-3 ${labels.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ pointerEvents: ready ? "auto" : "none" }}>
        {labels.map((l, k) => (
          <button key={l} onClick={() => onPick(k)} className="pressable flex h-16 min-w-[100px] items-center justify-center rounded-full border px-3 text-[17px] font-semibold" style={k === 0 ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--hairline-strong)" }}>
            {l}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── bits ───────────────────────── */

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.16 } }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col pt-4">
      {children}
    </motion.section>
  );
}

function Prompt({ text }: { text: string }) {
  const typed = useTypewriter(text);
  return <TypedHeading text={text} typed={typed} ready={typed.length >= text.length} size={38} />;
}

function NextButton({ onClick, disabled, label = "Next", ghost }: { onClick: () => void; disabled?: boolean; label?: string; ghost?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`pressable mt-6 flex h-14 w-full items-center justify-center text-[16px] ${ghost ? "btn-ghost" : "btn-primary"}`} style={{ opacity: disabled ? 0.45 : 1 }} data-next>
      {label}
    </button>
  );
}

function Chevron() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
