"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { storyParagraphs } from "@/lib/hot";
import { saveStory } from "@/app/admin/actions";

/**
 * The blog editor. Big textarea on the left, the story as it will read on the
 * right (below, on a phone). Save writes the story and the shelf settings.
 */
export function StoryEditor({ slug, name, take, story: initial, hot: hot0, hotRank: rank0, photoUrl, writable }: { slug: string; name: string; take: string; story: string; hot: boolean; hotRank: number | null; photoUrl?: string; writable: boolean }) {
  const router = useRouter();
  const [story, setStory] = useState(initial);
  const [hot, setHot] = useState(hot0);
  const [rank, setRank] = useState<string>(rank0 ? String(rank0) : "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = story !== initial || hot !== hot0 || rank !== (rank0 ? String(rank0) : "");
  const words = story.trim() ? story.trim().split(/\s+/).length : 0;
  const paragraphs = storyParagraphs(story);

  const save = () =>
    start(async () => {
      const r = await saveStory(slug, { story, hot, hotRank: rank === "" ? null : Number(rank) });
      setMsg(r.ok ? { ok: true, text: "Saved. Live within a minute." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <main className="screen pb-24 pt-4">
      <header className="sticky top-0 z-30 -mx-5 flex items-center justify-between px-5 py-3 lg:mx-0 lg:px-0" style={{ background: "rgba(243,237,224,0.92)", backdropFilter: "blur(12px)" }}>
        <Link href="/admin/stories" className="pressable -ml-2 flex h-11 items-center gap-1 pl-2 pr-3 text-[13.5px]" aria-label="Back to stories">
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Stories
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[12px]" style={{ color: dirty ? "var(--tomato)" : "var(--ink-35)" }}>
            {dirty ? "Unsaved" : "Saved"}
          </span>
          <button onClick={save} disabled={pending || !writable || !dirty} className="pressable btn-primary flex h-10 items-center px-5 text-[14px]" style={{ opacity: pending || !writable || !dirty ? 0.5 : 1 }}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <p className="eyebrow mt-4">Story</p>
      <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }}>
        {name}
      </h1>
      <p className="mt-2 text-[13.5px]" style={{ color: "var(--ink-55)" }}>
        {take}
      </p>
      {msg && (
        <p className="mt-3 text-[13.5px]" style={{ color: msg.ok ? "var(--pine)" : "var(--tomato-deep)" }}>
          {msg.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[18px] border px-4 py-3" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
        <label className="flex items-center gap-2 text-[14px]">
          <button type="button" role="switch" aria-checked={hot} onClick={() => setHot(!hot)} className="pressable relative h-7 w-12 rounded-full transition-colors" style={{ background: hot ? "var(--tomato)" : "rgba(22,33,58,0.12)" }}>
            <span className="absolute top-1 h-5 w-5 rounded-full transition-all" style={{ left: hot ? 24 : 4, background: "var(--paper)" }} />
          </button>
          On the shelf
        </label>
        <label className="flex items-center gap-2 text-[14px]">
          Order
          <input type="number" min={1} max={99} value={rank} onChange={(e) => setRank(e.target.value)} placeholder="—" className="h-9 w-16 rounded-full border px-3 text-center text-[14px] outline-none" style={{ background: "var(--paper)", borderColor: "var(--hairline-strong)" }} />
        </label>
        <span className="ml-auto text-[12.5px]" style={{ color: "var(--ink-35)" }}>
          {words} words · {paragraphs.length} paragraphs
        </span>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value.slice(0, 12000))}
          placeholder={"Nobody talks about the back room, which is the point.\n\nGo on a Tuesday…"}
          rows={22}
          className="w-full resize-y rounded-[18px] border p-4 text-[16px] leading-relaxed outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)", minHeight: 420 }}
        />
        <div className="card overflow-hidden">
          <div className="grain relative h-40 w-full" style={{ background: "linear-gradient(160deg, #161922, #3a4150)" }}>
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <span className="absolute left-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em]" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>
              HOT RIGHT NOW
            </span>
          </div>
          <div className="p-5">
            <p className="eyebrow">Preview</p>
            <h2 className="serif mt-1" style={{ fontSize: 28, lineHeight: 1.05 }}>
              {name}
            </h2>
            <div className="story mt-4">
              {paragraphs.length === 0 ? (
                <p className="text-[14px]" style={{ color: "var(--ink-35)" }}>
                  Start typing on the left.
                </p>
              ) : (
                paragraphs.map((p, i) => (
                  <p key={i} className={i === 0 ? "serif text-[19px] leading-snug" : "text-[15px] leading-relaxed"} style={{ color: i === 0 ? "var(--ink)" : "var(--ink-70)" }}>
                    {p}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
        Everything else about this place (traits, hours, photo) is in{" "}
        <Link href={`/admin/v/${slug}`} className="underline">
          the editor
        </Link>
        . The public page is{" "}
        <Link href={`/v/${slug}#story`} className="underline">
          here
        </Link>
        .
      </p>
    </main>
  );
}
