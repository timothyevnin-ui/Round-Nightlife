"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ATTR_GROUPS, ATTR_LIST, SUGGESTED_TAGS, type AttrKey } from "@/lib/attrs";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { slugify } from "@/lib/slug";
import type { Attrs, Capacity, Venue, Window } from "@/lib/types";
import { adoptPhoto, draftFromNotes, draftTake, fillFromWeb, findPhotos, lookupAddress, removeVenue, saveVenue, type SavePayload } from "@/app/admin/actions";
import { HoursEditor } from "./HoursEditor";
import { ScoreBadge } from "@/components/Score";
import { weekSummary } from "@/lib/hours";
import { shrinkPhoto } from "@/lib/photo";
import type { CommonsPhoto } from "@/lib/commons";

/* ───────────────────────── presets ───────────────────────── */

const WINDOW_PRESETS: { id: string; label: string; windows: Window[] }[] = [
  { id: "everyNight", label: "Every night · 6pm–2am", windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 26 }] },
  { id: "weekendLate", label: "Thu–Sat late · 9pm–3am (weeknights 7–1)", windows: [{ days: [4, 5, 6], from: 21, to: 27 }, { days: [0, 1, 2, 3], from: 19, to: 25 }] },
  { id: "brooklynLate", label: "Thu–Sat very late · 9pm–4am (weeknights 7–2)", windows: [{ days: [4, 5, 6], from: 21, to: 28 }, { days: [0, 1, 2, 3], from: 19, to: 26 }] },
  { id: "cocktailHours", label: "Every night · 7pm–1am", windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 19, to: 25 }] },
  { id: "earlyEvening", label: "Early · 5pm–11pm", windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 17, to: 23 }] },
  { id: "dinner", label: "Dinner · 6pm–11pm", windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 18, to: 23 }] },
];

function presetFor(windows: Window[]): string {
  const key = JSON.stringify(windows);
  return WINDOW_PRESETS.find((p) => JSON.stringify(p.windows) === key)?.id ?? "custom";
}

const EASY_IN = [
  { v: 0.85, label: "Walk right in" },
  { v: 0.65, label: "Usually fine" },
  { v: 0.4, label: "Often a wait" },
  { v: 0.15, label: "Good luck" },
];
const easyBucket = (n: number) => (n >= 0.75 ? 0.85 : n >= 0.5 ? 0.65 : n >= 0.28 ? 0.4 : 0.15);

const FIT = [
  { v: 0.15, label: "No" },
  { v: 0.6, label: "OK" },
  { v: 0.95, label: "Great" },
];
const fitBucket = (n: number) => (n >= 0.8 ? 0.95 : n >= 0.4 ? 0.6 : 0.15);

const TRI = [
  { v: 0, label: "No" },
  { v: 0.5, label: "Some" },
  { v: 1, label: "Yes" },
];
const triBucket = (n: number) => (n >= 0.75 ? 1 : n >= 0.25 ? 0.5 : 0);

/* ───────────────────────── form ───────────────────────── */

type Draft = Omit<SavePayload, "attrs"> & { attrs: Attrs };

/** A head start for a new place — from a recommendation in the inbox. */
export type Prefill = {
  suggestionId?: string;
  name?: string;
  kind?: "bar" | "restaurant";
  neighborhood?: string;
  address?: string;
  notes?: string;
  attrs?: Partial<Attrs>;
  price?: number;
  easyIn?: number;
  groupFit?: Venue["groupFit"];
  dateFit?: Venue["dateFit"];
};

function fromPrefill(p: Prefill): Draft {
  const b = blank();
  return {
    ...b,
    suggestionId: p.suggestionId,
    name: p.name ?? b.name,
    kind: p.kind ?? b.kind,
    neighborhood: p.neighborhood ?? b.neighborhood,
    address: p.address ?? b.address,
    notes: p.notes ?? b.notes,
    attrs: { ...b.attrs, ...(p.attrs ?? {}) },
    price: p.price ?? b.price,
    easyIn: p.easyIn ?? b.easyIn,
    groupFit: p.groupFit ?? b.groupFit,
    dateFit: p.dateFit ?? b.dateFit,
  };
}

function blank(): Draft {
  const attrs = Object.fromEntries(ATTR_LIST.map((a) => [a.key, 0])) as Attrs;
  return {
    name: "",
    kind: "bar",
    neighborhood: "west-village",
    address: "",
    lat: null,
    lng: null,
    take: "",
    theCatch: "",
    notes: "",
    tags: [],
    attrs,
    groupFit: { two: 0.6, small: 0.6, mid: 0.6, big: 0.15 },
    dateFit: { first: 0.6, early: 0.6, longterm: 0.6 },
    price: 2,
    capacity: "medium",
    easyIn: 0.65,
    bestWindows: WINDOW_PRESETS[0].windows,
    verified: false,
    friendsBeen: 0,
    hot: false,
    hotRank: null,
    story: "",
    hours: null,
    barFood: false,
    cuisine: "",
    score: null,
    dayDeal: "",
  };
}

function fromVenue(v: Venue): Draft {
  return {
    slug: v.slug,
    originalSlug: v.slug,
    name: v.name,
    kind: v.kind,
    neighborhood: v.neighborhood,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    take: v.take,
    theCatch: v.theCatch ?? "",
    notes: v.notes ?? "",
    tags: v.tags,
    attrs: { ...v.attrs },
    groupFit: { ...v.groupFit },
    dateFit: { ...v.dateFit },
    price: v.price,
    capacity: v.capacity,
    easyIn: v.easyIn,
    bestWindows: v.bestWindows,
    verified: v.verified,
    friendsBeen: v.friendsBeen ?? 0,
    photoUrl: v.photoUrl,
    photoCredit: v.photoCredit ?? "",
    perk: v.perk,
    hot: !!v.hot,
    hotRank: v.hotRank ?? null,
    story: v.story ?? "",
    hours: v.hours ?? null,
    barFood: !!v.barFood,
    cuisine: v.cuisine ?? "",
    score: typeof v.score === "number" ? v.score : null,
    dayDeal: v.dayDeal ?? "",
  };
}

export function VenueForm({ venue, writable, prefill }: { venue: Venue | null; writable: boolean; prefill?: Prefill }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => (venue ? fromVenue(venue) : prefill ? fromPrefill(prefill) : blank()));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [geo, setGeo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [quick, setQuick] = useState<{ notes: string; busy: boolean; done: string | null }>({ notes: "", busy: false, done: null });

  const draftAll = () =>
    startAi(async () => {
      setQuick((q) => ({ ...q, busy: true, done: null }));
      setMsg(null);
      const r = await draftFromNotes(quick.notes);
      if (r.error || !r.draft) {
        setQuick((q) => ({ ...q, busy: false }));
        setMsg({ kind: "err", text: r.error ?? "Nothing came back." });
        return;
      }
      const dr = r.draft;
      setD((x) => ({
        ...x,
        name: dr.name ?? x.name,
        kind: dr.kind ?? x.kind,
        neighborhood: dr.neighborhood ?? x.neighborhood,
        address: dr.address ?? x.address,
        take: dr.take ?? x.take,
        theCatch: dr.theCatch ?? x.theCatch,
        tags: dr.tags?.length ? dr.tags : x.tags,
        attrs: { ...x.attrs, ...(dr.attrs ?? {}) },
        groupFit: dr.groupFit ?? x.groupFit,
        dateFit: dr.dateFit ?? x.dateFit,
        price: dr.price ?? x.price,
        capacity: dr.capacity ?? x.capacity,
        easyIn: dr.easyIn ?? x.easyIn,
        bestWindows: dr.bestWindowsResolved ?? x.bestWindows,
        notes: [x.notes, quick.notes].filter(Boolean).join("\n\n"),
      }));
      const filled = ["name", "address", "take", "theCatch", "tags", "attrs", "price", "capacity", "easyIn", "bestWindows"].filter((k) => (dr as Record<string, unknown>)[k] !== undefined);
      setQuick({ notes: "", busy: false, done: `Filled in ${filled.length} things. Read it over, tap Find on the address, then Save.` });
    });

  const [finder, setFinder] = useState<{ open: boolean; q: string; results: CommonsPhoto[] | null; busy: boolean; using: string | null; error: string | null }>({ open: false, q: "", results: null, busy: false, using: null, error: null });
  const isNew = !venue;
  const preset = useMemo(() => presetFor(d.bestWindows), [d.bestWindows]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setAttr = (k: AttrKey, v: number) => setD((x) => ({ ...x, attrs: { ...x.attrs, [k]: v } }));

  const save = () =>
    start(async () => {
      setMsg(null);
      const fd = new FormData();
      const payload: SavePayload = { ...d, slug: d.slug || slugify(d.name) };
      fd.set("payload", JSON.stringify(payload));
      if (photoFile) fd.set("photo", photoFile);
      const r = await saveVenue(fd);
      if (r.ok) {
        setMsg({ kind: "ok", text: "Saved. Live within a minute." });
        setPhotoFile(null);
        if (isNew || r.slug !== venue?.slug) router.push(`/admin/v/${r.slug}`);
        router.refresh();
      } else setMsg({ kind: "err", text: r.error });
    });

  const del = () => {
    if (!venue) return;
    if (!window.confirm(`Delete ${venue.name}? This can't be undone.`)) return;
    start(async () => {
      const r = await removeVenue(venue.slug);
      if (r.ok) router.push("/admin");
      else setMsg({ kind: "err", text: r.error });
    });
  };

  const lookup = () =>
    start(async () => {
      const r = await lookupAddress(d.address);
      if ("error" in r) setMsg({ kind: "err", text: r.error });
      else {
        setD((x) => ({ ...x, lat: r.lat, lng: r.lng, neighborhood: r.neighborhood ?? x.neighborhood }));
        setGeo(r.neighborhood ? `${r.label} → ${NEIGHBORHOODS.find((n) => n.id === r.neighborhood)?.name ?? r.neighborhood}` : r.label);
      }
    });

  const draft = () =>
    startAi(async () => {
      setMsg(null);
      const r = await draftTake({ name: d.name, neighborhood: d.neighborhood, kind: d.kind, notes: d.notes ?? "", tags: d.tags, attrs: d.attrs });
      if (r.error) setMsg({ kind: "err", text: r.error });
      else setD((x) => ({ ...x, take: r.take || x.take, theCatch: r.theCatch || x.theCatch }));
    });

  const addTag = (t: string) => {
    const clean = t.trim();
    if (!clean) return;
    setD((x) => ({ ...x, tags: x.tags.includes(clean) ? x.tags.filter((y) => y !== clean) : [...x.tags, clean].slice(0, 12) }));
    setTagInput("");
  };

  const openFinder = () => setFinder((f) => ({ ...f, open: true, q: f.q || `${d.name} ${d.kind === "restaurant" ? "restaurant" : "bar"} New York`, error: null }));

  const search = () => {
    const q = finder.q.trim();
    if (!q) return;
    setFinder((f) => ({ ...f, busy: true, error: null }));
    startAi(async () => {
      const r = await findPhotos(q);
      if ("error" in r) setFinder((f) => ({ ...f, busy: false, error: r.error }));
      else setFinder((f) => ({ ...f, busy: false, results: r.photos }));
    });
  };

  const choose = (p: CommonsPhoto) => {
    setFinder((f) => ({ ...f, using: p.title, error: null }));
    startAi(async () => {
      const r = await adoptPhoto({ slug: d.slug || slugify(d.name) || "place", thumb: p.thumb, credit: p.credit });
      if ("error" in r) setFinder((f) => ({ ...f, using: null, error: r.error }));
      else {
        setPhotoFile(null);
        setPhotoPreview(null);
        setD((x) => ({ ...x, photoUrl: r.photoUrl, photoCredit: r.photoCredit }));
        setFinder((f) => ({ ...f, using: null, open: false }));
        setMsg({ kind: "ok", text: "Photo's in. Hit Save to keep it." });
      }
    });
  };

  const [site, setSite] = useState("");
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const readSite = async () => {
    if (!site.trim()) return;
    setReading(true);
    setReadNote(null);
    const r = await fillFromWeb({ url: site, name: d.name, address: d.address });
    setReading(false);
    if (r.error || !r.fill) return setReadNote(r.error ?? "Nothing found.");
    const found: string[] = [];
    if (r.fill.hours) {
      set("hours", r.fill.hours);
      found.push(`hours (${weekSummary(r.fill.hours)})`);
    }
    if (r.fill.cuisine && !d.cuisine) {
      set("cuisine", r.fill.cuisine);
      found.push(`food: ${r.fill.cuisine}`);
    }
    if (r.fill.barFood === true && d.kind === "bar" && !d.barFood) {
      set("barFood", true);
      found.push("it has a kitchen");
    }
    setReadNote(found.length ? `Got ${found.join(", ")}.` : `Read the page but it doesn't post hours. ${r.fill.summary ?? ""}`);
  };

  const pickPhoto = async (f: File | null) => {
    if (!f) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setMsg(null);
    const small = await shrinkPhoto(f).catch(() => f);
    setPhotoFile(small);
    setPhotoPreview(URL.createObjectURL(small));
    setD((x) => ({ ...x, photoCredit: "" }));
  };

  return (
    <main className="screen pb-24">
      <header className="sticky top-0 z-30 -mx-5 flex items-center justify-between px-5 py-3 lg:mx-0 lg:px-0" style={{ background: "rgba(243,237,224,0.92)", backdropFilter: "blur(12px)", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <Link href="/admin" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="eyebrow">{isNew ? (prefill?.suggestionId ? "From a recommendation" : "New place") : "Edit"}</span>
        <button onClick={save} disabled={pending || !writable} className="pressable btn-primary flex h-10 items-center px-5 text-[14px]" style={{ opacity: pending || !writable ? 0.5 : 1 }}>
          {pending ? "Saving…" : "Save"}
        </button>
      </header>

      {!writable && (
        <div className="card mt-4 p-4 text-[13px]" style={{ color: "var(--chalk-70)" }}>
          Read-only until Supabase is connected (see SUPABASE.md).
        </div>
      )}
      {prefill?.suggestionId && (
        <div className="card mt-4 p-4 text-[13px] leading-snug" style={{ color: "var(--chalk-70)" }}>
          <strong style={{ color: "var(--chalk)" }}>Filled in from what they told us.</strong> Their answers set the traits below; the rest is yours. Saving marks the recommendation as added.
        </div>
      )}
      {msg && (
        <div className="card mt-4 p-4 text-[13.5px]" style={{ color: msg.kind === "ok" ? "var(--chalk)" : "#ff8a8a", borderColor: msg.kind === "ok" ? "var(--cobalt)" : "rgba(255,138,138,0.4)" }}>
          {msg.text}
        </div>
      )}

      {isNew && (
        <Section title="Start from your notes" hint="Paste what you'd text a friend: where it is, what it was like, what it cost, when it fills up. Claude fills the form; you fix what's wrong and Save.">
          <TextArea value={quick.notes} onChange={(v) => setQuick((q) => ({ ...q, notes: v }))} placeholder={"The Red Lion, 151 Bleecker. Went Thurs with 6, cover band, cheap pitchers, packed by 10, no line before 9…"} rows={5} max={4000} />
          <button onClick={draftAll} disabled={aiPending || quick.notes.trim().length < 10} className="pressable btn-accent flex h-12 items-center justify-center px-5 text-[14.5px]" style={{ opacity: aiPending || quick.notes.trim().length < 10 ? 0.55 : 1 }}>
            {quick.busy ? "Reading your notes…" : "Draft the whole place"}
          </button>
          {quick.done && (
            <p className="text-[13px]" style={{ color: "var(--pine)" }}>
              {quick.done}
            </p>
          )}
        </Section>
      )}

      {/* ── Basics ── */}
      <Section title="Basics">
        <Field label="Name">
          <TextInput value={d.name} onChange={(v) => set("name", v)} placeholder="The Red Lion" big />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Neighborhood">
            <select value={d.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className={selectCls} style={inputStyle}>
              {NEIGHBORHOODS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kind">
            <Segmented options={[{ v: "bar", label: "Bar" }, { v: "restaurant", label: "Restaurant" }]} value={d.kind} onChange={(v) => set("kind", v as "bar" | "restaurant")} />
          </Field>
        </div>
        <Field label="Address">
          <div className="flex gap-2">
            <TextInput value={d.address} onChange={(v) => set("address", v)} placeholder="151 Bleecker St, New York, NY 10012" />
            <button onClick={lookup} disabled={pending} className="pressable btn-ghost shrink-0 px-4 text-[13px]">
              Find
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--chalk-35)" }}>
            {geo ?? (d.lat && d.lng ? `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}` : "Tap Find to put it on the map.")}
          </p>
        </Field>
      </Section>

      {/* ── The verdict ── */}
      <Section title="ROUND's Take" hint="One sentence. Confident, specific, dry. The thing you'd text a friend.">
        <TextArea value={d.take} onChange={(v) => set("take", v)} placeholder="Crowded, social, and good if your group wants somewhere lively without going full club." rows={3} max={220} />
        <Field label="The catch" hint="What Maps doesn't know: the line, when to arrive, what to order.">
          <TextArea value={d.theCatch ?? ""} onChange={(v) => set("theCatch", v)} placeholder="Line after 9:30 on Thursdays; go early or expect to stand." rows={2} max={160} />
        </Field>
        <Field label="Your notes (private)" hint="Raw thoughts, dates you went, what happened. Never shown to users. The AI drafts from these.">
          <TextArea value={d.notes ?? ""} onChange={(v) => set("notes", v)} placeholder="Went Thurs 10/2 with 6. Packed by 10, got a booth in back, DJ after 11, $9 beers…" rows={4} max={2000} />
        </Field>
        <button onClick={draft} disabled={aiPending || !d.name} className="pressable btn-ghost flex h-11 items-center gap-2 px-4 text-[13.5px]" style={{ opacity: aiPending ? 0.6 : 1 }}>
          {aiPending ? "Drafting…" : "Draft the Take from my notes"}
        </button>
      </Section>

      {/* ── Tags ── */}
      <Section title="Tags" hint="What shows on the card. Tap to toggle, or type your own.">
        <div className="flex flex-wrap gap-2">
          {[...new Set([...d.tags, ...SUGGESTED_TAGS])].map((t) => {
            const on = d.tags.includes(t);
            return (
              <button key={t} onClick={() => addTag(t)} className="pressable rounded-full border px-3 py-1.5 text-[13px] font-medium" style={on ? { background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "var(--chalk)" } : { borderColor: "var(--hairline-strong)", color: "var(--chalk-70)" }}>
                {t}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <TextInput value={tagInput} onChange={setTagInput} placeholder="Add a tag" onEnter={() => addTag(tagInput)} />
          <button onClick={() => addTag(tagInput)} className="pressable btn-ghost shrink-0 px-4 text-[13px]">
            Add
          </button>
        </div>
      </Section>

      {/* ── Attributes ── */}
      <Section title="What it's like" hint="These are what the questions match against. No / Some / Yes.">
        {ATTR_GROUPS.map((g) => (
          <div key={g.id} className="mt-2">
            <p className="eyebrow mt-3">{g.label}</p>
            <div className="mt-2 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
              {ATTR_LIST.filter((a) => a.group === g.id).map((a) => (
                <div key={a.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium">{a.label}</p>
                    <p className="truncate text-[11.5px]" style={{ color: "var(--chalk-35)" }}>
                      {a.hint}
                    </p>
                  </div>
                  <Tri value={triBucket(d.attrs[a.key])} onChange={(v) => setAttr(a.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── Fit ── */}
      <Section title="Who it works for">
        <p className="eyebrow">Group size</p>
        {(
          [
            ["two", "Two of you"],
            ["small", "3–4"],
            ["mid", "5–7"],
            ["big", "8+"],
          ] as const
        ).map(([k, label]) => (
          <Row key={k} label={label}>
            <Segmented options={FIT} value={fitBucket(d.groupFit[k])} onChange={(v) => set("groupFit", { ...d.groupFit, [k]: Number(v) })} small />
          </Row>
        ))}
        <p className="eyebrow mt-5">Dates</p>
        {(
          [
            ["first", "First date"],
            ["early", "A few dates in"],
            ["longterm", "Long-term"],
          ] as const
        ).map(([k, label]) => (
          <Row key={k} label={label}>
            <Segmented options={FIT} value={fitBucket(d.dateFit[k])} onChange={(v) => set("dateFit", { ...d.dateFit, [k]: Number(v) })} small />
          </Row>
        ))}
      </Section>

      {/* ── The room ── */}
      <Section title="The room">
        <Field label="Size">
          <Segmented options={[{ v: "tiny", label: "Tiny" }, { v: "small", label: "Small" }, { v: "medium", label: "Medium" }, { v: "large", label: "Big" }]} value={d.capacity} onChange={(v) => set("capacity", v as Capacity)} />
        </Field>
        <Field label="Getting in at peak">
          <Segmented options={EASY_IN} value={easyBucket(d.easyIn)} onChange={(v) => set("easyIn", Number(v))} wrap />
        </Field>
        <Field label="Price">
          <Segmented options={[{ v: 1, label: "$" }, { v: 2, label: "$$" }, { v: 3, label: "$$$" }, { v: 4, label: "$$$$" }]} value={d.price} onChange={(v) => set("price", Number(v))} />
        </Field>
        <Field label="Best hours" hint="When ROUND should send people. Not opening hours — the good hours.">
          <select
            value={preset}
            onChange={(e) => {
              const p = WINDOW_PRESETS.find((x) => x.id === e.target.value);
              if (p) set("bestWindows", p.windows);
            }}
            className={selectCls}
            style={inputStyle}
          >
            {preset === "custom" && <option value="custom">Custom (kept as is)</option>}
            {WINDOW_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Photo ── */}
      {/* ── Hours, food, score ── */}
      <Section title="Hours, food, score" hint="What shows on the card under the name: the posted hours (tonight's, with the week a tap away), what kind of food, and ROUND's score.">
        <Field label="Fill in from the web" hint="Paste the place's own website. Claude reads the hours and the food off it; nothing is guessed.">
          <div className="flex gap-2">
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://…" className="h-12 flex-1 rounded-[14px] border px-4 text-[15px] outline-none" style={inputStyle} />
            <button type="button" onClick={readSite} disabled={reading || !site.trim()} className="pressable btn-ghost h-12 px-4 text-[14px]" style={{ opacity: reading || !site.trim() ? 0.5 : 1 }}>
              {reading ? "Reading…" : "Read it"}
            </button>
          </div>
          {readNote && (
            <p className="mt-2 text-[13px]" style={{ color: "var(--chalk-70)" }}>
              {readNote}
            </p>
          )}
        </Field>
        <Field label="Posted hours">
          <HoursEditor value={d.hours ?? undefined} onChange={(h) => set("hours", h ?? null)} />
        </Field>
        <Row label={d.kind === "restaurant" ? "It's a restaurant (food is the point)" : "Bar with a kitchen (real food menu)"}>
          <Toggle on={d.kind === "restaurant" ? true : !!d.barFood} onChange={(v) => d.kind !== "restaurant" && set("barFood", v)} />
        </Row>
        <Field label="What kind of food" hint="Shows first in the keywords line: Italian, Cheesesteaks, Tacos.">
          <input value={d.cuisine ?? ""} onChange={(e) => set("cuisine", e.target.value)} placeholder={d.kind === "restaurant" || d.barFood ? "Cheesesteaks" : "Leave blank for drinks-only"} className="h-12 w-full rounded-[14px] border px-4 text-[15px] outline-none" style={inputStyle} />
        </Field>
        <Field label="ROUND's score" hint="How much we like it, out of 100. Sits in the ring next to ROUND says; blank means no score shows.">
          <div className="flex items-center gap-4">
            <ScoreBadge score={d.score ?? undefined} size={56} />
            <input type="range" min={0} max={100} value={d.score ?? 75} onChange={(e) => set("score", Number(e.target.value))} className="flex-1" style={{ accentColor: "var(--tomato)" }} aria-label="ROUND's score" />
            <input type="number" min={0} max={100} value={d.score ?? ""} onChange={(e) => set("score", e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))))} placeholder="—" className="h-11 w-20 rounded-[12px] border px-3 text-center text-[15px] outline-none" style={inputStyle} />
            <button type="button" onClick={() => set("score", null)} className="pressable text-[12.5px]" style={{ color: "var(--chalk-55)" }}>
              clear
            </button>
          </div>
        </Field>
      </Section>

      {/* ── Daytime ── */}
      <Section title="Daytime" hint="Saturday at 2pm: is this a place? When the time on Home is before 5pm, the picks lean on this.">
        <Row label={`Good during the day${d.attrs.daytime >= 0.7 ? " · yes" : d.attrs.daytime <= 0.2 ? " · no" : " · sort of"}`}>
          <Toggle on={d.attrs.daytime >= 0.7} onChange={(v) => set("attrs", { ...d.attrs, daytime: v ? 0.9 : 0.1 })} />
        </Row>
        <Field label="Day deal" hint="One line, shows with the hours: $5 pitchers till 6 · half-price oysters 3–6 · $10 frozen margs.">
          <input value={d.dayDeal ?? ""} onChange={(e) => set("dayDeal", e.target.value)} placeholder="$5 pitchers till 6" className="h-12 w-full rounded-[14px] border px-4 text-[15px] outline-none" style={inputStyle} />
        </Field>
      </Section>

      <Section title="Photo" hint="Yours is best: shot at night, in the room, no filters. Or find a free-to-use one from Wikimedia Commons; the credit rides along.">
        <div className="flex items-center gap-4">
          <div className="grain relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px]" style={{ background: "linear-gradient(160deg, #161922, #3a4150)" }}>
            {(photoPreview ?? d.photoUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview ?? d.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileRef.current?.click()} className="pressable btn-ghost flex h-11 items-center px-4 text-[13.5px]">
                {d.photoUrl || photoPreview ? "Replace" : "Upload yours"}
              </button>
              <button onClick={openFinder} disabled={!d.name.trim()} className="pressable btn-ghost flex h-11 items-center px-4 text-[13.5px]" style={{ opacity: d.name.trim() ? 1 : 0.5 }}>
                Find a photo
              </button>
            </div>
            {d.photoCredit ? (
              <p className="truncate text-[11.5px]" style={{ color: "var(--chalk-55)" }}>
                {d.photoCredit}
              </p>
            ) : null}
            {(d.photoUrl || photoPreview) && (
              <button
                onClick={() => {
                  pickPhoto(null);
                  setD((x) => ({ ...x, photoUrl: "", photoCredit: "" }));
                }}
                className="pressable text-left text-[12px]"
                style={{ color: "var(--chalk-35)" }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {finder.open && (
          <div className="card mt-2 p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Wikimedia Commons · free to use</p>
              <button onClick={() => setFinder((f) => ({ ...f, open: false }))} className="pressable text-[12px]" style={{ color: "var(--chalk-35)" }}>
                Close
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <TextInput value={finder.q} onChange={(v) => setFinder((f) => ({ ...f, q: v }))} placeholder="McSorley's Old Ale House" onEnter={search} />
              <button onClick={search} disabled={finder.busy} className="pressable btn-primary shrink-0 px-4 text-[13px]" style={{ opacity: finder.busy ? 0.6 : 1 }}>
                {finder.busy ? "Looking…" : "Search"}
              </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "var(--chalk-35)" }}>
              Only photos with a license that allows reuse show up (public domain, CC0, CC BY, CC BY-SA). The famous rooms are usually here; for the rest, your phone is the camera. Google Images can&apos;t be used: those pictures belong to whoever took them.
            </p>
            {finder.error && (
              <p className="mt-2 text-[12.5px]" style={{ color: "#c0392b" }}>
                {finder.error}
              </p>
            )}
            {finder.results && finder.results.length === 0 && (
              <p className="mt-3 text-[13px]" style={{ color: "var(--chalk-55)" }}>
                Nothing free to use for that. Try the street name, or upload your own.
              </p>
            )}
            {finder.results && finder.results.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-3">
                {finder.results.map((p) => (
                  <li key={p.title} className="overflow-hidden rounded-[16px] border" style={{ borderColor: "var(--hairline)" }}>
                    <div className="relative aspect-[4/3] w-full" style={{ background: "var(--ink-6)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumb} alt={p.description ?? p.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-[11.5px] font-medium">{p.artist}</p>
                      <p className="truncate text-[11px]" style={{ color: "var(--chalk-55)" }}>
                        {p.license} · {p.width}×{p.height}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button onClick={() => choose(p)} disabled={!!finder.using} className="pressable btn-primary flex h-9 flex-1 items-center justify-center text-[12.5px]" style={{ opacity: finder.using && finder.using !== p.title ? 0.5 : 1 }}>
                          {finder.using === p.title ? "Copying…" : "Use this"}
                        </button>
                        <a href={p.page} target="_blank" rel="noreferrer" className="pressable text-[11.5px] underline" style={{ color: "var(--chalk-55)" }}>
                          Source
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* ── What's hot ── */}
      <Section title="What's hot right now" hint="The shelf on the home page. Flip it on, write the story, and it's live within a minute.">
        <Row label="On the shelf">
          <Toggle on={!!d.hot} onChange={(v) => set("hot", v)} />
        </Row>
        <Row label="Order on the shelf (1 = first)">
          <input
            type="number"
            min={1}
            max={99}
            value={d.hotRank ?? ""}
            onChange={(e) => set("hotRank", e.target.value === "" ? null : Number(e.target.value))}
            className="h-10 w-20 rounded-full border px-3 text-center text-[14px] outline-none"
            style={inputStyle}
            placeholder="—"
          />
        </Row>
        <Field label="The story" hint="The long read: why this place, right now. Your voice, a few paragraphs, blank line between them. This is the blog.">
          <TextArea
            value={d.story ?? ""}
            onChange={(v) => set("story", v)}
            placeholder={"Nobody talks about the back room, which is the point.\n\nGo on a Tuesday…"}
            rows={10}
            max={8000}
          />
        </Field>
      </Section>

      {/* ── Status ── */}
      <Section title="Status">
        <Row label="Verified — you've been, and it's right">
          <Toggle on={d.verified} onChange={(v) => set("verified", v)} />
        </Row>
        <Row label="Regulars (shown as friends until the graph exists)">
          <input
            type="number"
            min={0}
            max={99}
            value={d.friendsBeen ?? 0}
            onChange={(e) => set("friendsBeen", Number(e.target.value))}
            className="h-10 w-20 rounded-full border px-3 text-center text-[14px] outline-none"
            style={inputStyle}
          />
        </Row>
        <Field label="Member perk (later)" hint="Empty for now. The membership phase fills this.">
          <TextInput value={d.perk ?? ""} onChange={(v) => set("perk", v)} placeholder="A welcome drink · no wait for groups under 6 before 10" />
        </Field>
      </Section>

      <div className="mt-8 flex flex-col gap-3">
        <button onClick={save} disabled={pending || !writable} className="pressable btn-primary flex h-14 items-center justify-center text-[16px]" style={{ opacity: pending || !writable ? 0.5 : 1 }}>
          {pending ? "Saving…" : isNew ? "Add to ROUND" : "Save changes"}
        </button>
        {!isNew && (
          <div className="flex items-center justify-between px-1">
            <Link href={`/v/${venue!.slug}`} className="pressable text-[13px] underline" style={{ color: "var(--chalk-55)" }}>
              View the public page
            </Link>
            <button onClick={del} disabled={pending || !writable} className="pressable text-[13px]" style={{ color: "#ff8a8a" }}>
              Delete
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Phone photos are 3–8 MB; the card needs ~1600px. Shrink on the phone so the
 * upload is quick and never trips the server's request-size limit. Keeps EXIF
 * orientation (createImageBitmap honours it) and returns a JPEG.
 */
/* ───────────────────────── bits ───────────────────────── */

const inputStyle = { background: "rgba(22,33,58,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" } as const;
const selectCls = "h-12 w-full appearance-none rounded-[14px] border px-4 text-[15px] outline-none";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
      <h2 className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
        {title}
      </h2>
      {hint && (
        <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--chalk-55)" }}>
          {hint}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--chalk-35)" }}>
          {hint}
        </p>
      )}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <p className="text-[14px]" style={{ color: "var(--chalk-70)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, big, onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean; onEnter?: () => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={placeholder}
      className={`w-full rounded-[14px] border px-4 outline-none ${big ? "h-14 text-[20px]" : "h-12 text-[15px]"}`}
      style={{ ...inputStyle, fontFamily: big ? "var(--font-serif)" : undefined }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows, max }: { value: string; onChange: (v: string) => void; placeholder?: string; rows: number; max?: number }) {
  return (
    <div>
      <textarea value={value} onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)} placeholder={placeholder} rows={rows} className="w-full resize-none rounded-[14px] border p-4 text-[15px] leading-snug outline-none" style={inputStyle} />
      {max && (
        <p className="mt-1 text-right text-[11px]" style={{ color: "var(--chalk-35)" }}>
          {value.length}/{max}
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string | number>({ options, value, onChange, small, wrap }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; small?: boolean; wrap?: boolean }) {
  return (
    <div className={`flex gap-1.5 ${wrap ? "flex-wrap" : ""}`}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={`pressable rounded-full border font-medium ${small ? "h-9 px-3.5 text-[12.5px]" : "h-11 flex-1 px-3 text-[13.5px]"}`}
            style={on ? { background: "var(--chalk)", color: "var(--chalk-black)", borderColor: "var(--chalk)" } : { borderColor: "var(--hairline-strong)", color: "var(--chalk-70)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Tri({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      {TRI.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="pressable h-9 rounded-full border px-3 text-[12.5px] font-medium"
            style={
              on
                ? o.v === 1
                  ? { background: "var(--cobalt)", borderColor: "var(--cobalt)", color: "var(--chalk)" }
                  : o.v === 0.5
                    ? { background: "rgba(22,33,58,0.18)", borderColor: "rgba(22,33,58,0.3)", color: "var(--chalk)" }
                    : { background: "rgba(22,33,58,0.08)", borderColor: "rgba(22,33,58,0.25)", color: "var(--chalk)" }
                : { borderColor: "var(--hairline)", color: "var(--chalk-35)" }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="pressable relative h-8 w-14 shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--cobalt)" : "rgba(22,33,58,0.12)" }}>
      <span className="absolute top-1 h-6 w-6 rounded-full transition-all" style={{ left: on ? 28 : 4, background: "var(--chalk)" }} />
    </button>
  );
}
