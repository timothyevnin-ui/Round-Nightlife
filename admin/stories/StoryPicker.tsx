"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { matchVenues } from "@/lib/match";

/** "Write a story about…" — type a name, pick the place, land in the editor. */
export function StoryPicker({ options }: { options: { slug: string; name: string; hood: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const hits = useMemo(() => (q.trim().length >= 2 ? matchVenues(q, options, 6).map((m) => m.venue) : []), [q, options]);
  return (
    <div className="relative mt-5">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && hits[0] && router.push(`/admin/stories/${hits[0].slug}`)}
        placeholder="Write a story about…"
        className="h-12 w-full rounded-full border px-4 text-[15px] outline-none"
        style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
      />
      {hits.length > 0 && (
        <ul className="absolute left-0 right-0 top-[52px] z-20 overflow-hidden rounded-[18px] border shadow-lg" style={{ background: "var(--surface)", borderColor: "var(--hairline)" }}>
          {hits.map((h) => (
            <li key={h.slug} className="border-t first:border-t-0" style={{ borderColor: "var(--hairline)" }}>
              <button onClick={() => router.push(`/admin/stories/${h.slug}`)} className="pressable flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="serif text-[17px]">{h.name}</span>
                <span className="text-[12px]" style={{ color: "var(--ink-55)" }}>
                  {h.hood}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
