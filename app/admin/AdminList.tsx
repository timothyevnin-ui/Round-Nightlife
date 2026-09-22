"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Photo } from "@/components/Photo";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import type { Venue } from "@/lib/types";
import type { VenueSource } from "@/lib/db";
import { importSeed } from "./actions";

export function AdminList({ venues, source, dbCount, writable }: { venues: Venue[]; source: VenueSource; dbCount: number; writable: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hood, setHood] = useState<string>("all");
  const [only, setOnly] = useState<"all" | "unverified">("all");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return venues
      .filter((v) => hood === "all" || v.neighborhood === hood)
      .filter((v) => only === "all" || !v.verified)
      .filter((v) => !needle || v.name.toLowerCase().includes(needle) || v.tags.some((t) => t.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [venues, q, hood, only]);

  const runImport = () =>
    start(async () => {
      const r = await importSeed();
      setMsg(r.ok ? `Imported ${r.slug} places.` : r.error);
      if (r.ok) router.refresh();
    });

  return (
    <section className="mt-5">
      <div className="flex gap-2">
        <Link href="/admin/new" className="pressable btn-primary flex h-12 flex-1 items-center justify-center text-[15px]">
          + Add a place
        </Link>
        {writable && source === "seed" && (
          <button onClick={runImport} disabled={pending} className="pressable btn-ghost flex h-12 items-center px-4 text-[13px]" style={{ opacity: pending ? 0.6 : 1 }}>
            {pending ? "Importing…" : `Import ${venues.length} seed`}
          </button>
        )}
      </div>
      {msg && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--chalk-55)" }}>
          {msg}
        </p>
      )}
      {source === "db" && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--chalk-35)" }}>
          Live from the database · {dbCount} rows
        </p>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search names or tags"
        className="mt-4 h-12 w-full rounded-full border px-4 text-[15px] outline-none"
        style={{ background: "rgba(242,240,234,0.05)", borderColor: "var(--hairline-strong)", color: "var(--chalk)" }}
      />
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        <Chip active={hood === "all"} onClick={() => setHood("all")}>
          All
        </Chip>
        {NEIGHBORHOODS.map((n) => (
          <Chip key={n.id} active={hood === n.id} onClick={() => setHood(n.id)}>
            {n.short}
          </Chip>
        ))}
        <Chip active={only === "unverified"} onClick={() => setOnly(only === "all" ? "unverified" : "all")}>
          Unverified
        </Chip>
      </div>

      <ul className="mt-4 flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
        {list.map((v) => (
          <li key={v.slug}>
            <Link href={`/admin/v/${v.slug}`} className="pressable flex items-center gap-3 py-3" style={{ borderColor: "var(--hairline)" }}>
              <Photo venue={v} rounded="rounded-[12px]" className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                  {v.name}
                </p>
                <p className="truncate text-[12px]" style={{ color: "var(--chalk-55)" }}>
                  {neighborhoodName(v.neighborhood)} · {v.kind} · {v.tags.slice(0, 3).join(" · ") || "no tags"}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wide uppercase"
                style={v.verified ? { background: "var(--cobalt)", color: "var(--chalk)" } : { background: "rgba(242,240,234,0.08)", color: "var(--chalk-55)" }}
              >
                {v.verified ? "Verified" : "Draft"}
              </span>
            </Link>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-center text-[13.5px]" style={{ color: "var(--chalk-55)" }}>
            Nothing matches.
          </li>
        )}
      </ul>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="pressable shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium"
      style={active ? { background: "var(--chalk)", color: "var(--chalk-black)", borderColor: "var(--chalk)" } : { borderColor: "var(--hairline-strong)", color: "var(--chalk-70)" }}
    >
      {children}
    </button>
  );
}
