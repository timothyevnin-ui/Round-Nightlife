"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NEIGHBORHOODS, neighborhoodName } from "@/lib/neighborhoods";
import type { NeighborhoodId } from "@/lib/types";
import { setFlags } from "@/app/admin/actions";

export type PlaceRow = {
  slug: string;
  name: string;
  neighborhood: NeighborhoodId;
  kind: "bar" | "restaurant";
  price: number;
  verified: boolean;
  hot: boolean;
  hotRank: number | null;
  story: boolean;
  photo: boolean;
  tags: string[];
};

type SortKey = "name" | "neighborhood" | "price" | "verified" | "hot";

/** Every place, as a table on a laptop and a list on a phone. */
export function PlacesTable({ rows, writable }: { rows: PlaceRow[]; writable: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hood, setHood] = useState<string>("all");
  const [kind, setKind] = useState<"all" | "bar" | "restaurant">("all");
  const [only, setOnly] = useState<"all" | "unverified" | "verified" | "hot" | "nophoto" | "story">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => hood === "all" || r.neighborhood === hood)
      .filter((r) => kind === "all" || r.kind === kind)
      .filter((r) => (only === "unverified" ? !r.verified : only === "verified" ? r.verified : only === "hot" ? r.hot : only === "nophoto" ? !r.photo : only === "story" ? r.story : true))
      .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.tags.some((t) => t.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const k = sort.key;
        const av = k === "neighborhood" ? neighborhoodName(a.neighborhood) : k === "verified" || k === "hot" ? Number(a[k]) : a[k];
        const bv = k === "neighborhood" ? neighborhoodName(b.neighborhood) : k === "verified" || k === "hot" ? Number(b[k]) : b[k];
        const c = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
        return (c || a.name.localeCompare(b.name)) * sort.dir;
      });
  }, [rows, q, hood, kind, only, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const flag = (slugs: string[], patch: { verified?: boolean; hot?: boolean }) =>
    start(async () => {
      const r = await setFlags(slugs, patch);
      setMsg(r.ok ? `Updated ${r.slug}.` : r.error);
      if (r.ok) {
        setPicked(new Set());
        router.refresh();
      }
    });
  const allPicked = list.length > 0 && list.every((r) => picked.has(r.slug));

  return (
    <main className="screen pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Places</p>
          <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }}>
            {list.length === rows.length ? `${rows.length} places.` : `${list.length} of ${rows.length}.`}
          </h1>
        </div>
        <Link href="/admin/add" className="pressable btn-primary flex h-11 items-center px-5 text-[14px]">
          + Add a place
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names or tags" className="h-11 min-w-[220px] flex-1 rounded-full border px-4 text-[14px] outline-none" style={inputStyle} />
        <select value={hood} onChange={(e) => setHood(e.target.value)} className="h-11 rounded-full border px-3 text-[13.5px]" style={inputStyle}>
          <option value="all">All neighborhoods</option>
          {NEIGHBORHOODS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-11 rounded-full border px-3 text-[13.5px]" style={inputStyle}>
          <option value="all">Bars and restaurants</option>
          <option value="bar">Bars</option>
          <option value="restaurant">Restaurants</option>
        </select>
        <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)} className="h-11 rounded-full border px-3 text-[13.5px]" style={inputStyle}>
          <option value="all">Everything</option>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
          <option value="hot">On the shelf</option>
          <option value="story">Has a story</option>
          <option value="nophoto">No photo</option>
        </select>
      </div>

      {picked.size > 0 && writable && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[18px] border px-4 py-3" style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }}>
          <span className="text-[13.5px] font-medium">{picked.size} selected</span>
          <button onClick={() => flag([...picked], { verified: true })} disabled={pending} className="pressable btn-pine h-9 px-3.5 text-[13px]">
            Mark verified
          </button>
          <button onClick={() => flag([...picked], { verified: false })} disabled={pending} className="pressable btn-ghost h-9 px-3.5 text-[13px]">
            Unverify
          </button>
          <button onClick={() => flag([...picked], { hot: true })} disabled={pending} className="pressable btn-accent h-9 px-3.5 text-[13px]">
            Put on the shelf
          </button>
          <button onClick={() => flag([...picked], { hot: false })} disabled={pending} className="pressable btn-ghost h-9 px-3.5 text-[13px]">
            Take off the shelf
          </button>
          <button onClick={() => setPicked(new Set())} className="pressable ml-auto text-[12.5px]" style={{ color: "var(--ink-35)" }}>
            Clear
          </button>
        </div>
      )}
      {msg && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--ink-70)" }}>
          {msg}
        </p>
      )}
      {!writable && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
          Read-only until the database is connected and the list is imported.
        </p>
      )}

      {/* Laptop: the table */}
      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className="studio-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? new Set(list.map((r) => r.slug)) : new Set())} aria-label="Select all" />
              </th>
              <Th label="Name" k="name" sort={sort} onSort={toggleSort} />
              <Th label="Neighborhood" k="neighborhood" sort={sort} onSort={toggleSort} />
              <th>Kind</th>
              <Th label="Price" k="price" sort={sort} onSort={toggleSort} />
              <th>Tags</th>
              <Th label="Verified" k="verified" sort={sort} onSort={toggleSort} />
              <Th label="Shelf" k="hot" sort={sort} onSort={toggleSort} />
              <th>Story</th>
              <th>Photo</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.slug}>
                <td>
                  <input type="checkbox" checked={picked.has(r.slug)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.slug); else n.delete(r.slug); return n; })} aria-label={`Select ${r.name}`} />
                </td>
                <td>
                  <Link href={`/admin/v/${r.slug}`} className="serif text-[17px] underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td>{neighborhoodName(r.neighborhood)}</td>
                <td style={{ color: "var(--ink-55)" }}>{r.kind === "restaurant" ? "Restaurant" : "Bar"}</td>
                <td>{"$".repeat(r.price)}</td>
                <td className="max-w-[220px] truncate" style={{ color: "var(--ink-55)" }}>{r.tags.join(" · ")}</td>
                <td>
                  <Flag on={r.verified} onLabel="Verified" offLabel="Draft" disabled={!writable || pending} onClick={() => flag([r.slug], { verified: !r.verified })} tone="pine" />
                </td>
                <td>
                  <Flag on={r.hot} onLabel={r.hotRank ? `#${r.hotRank}` : "On"} offLabel="Off" disabled={!writable || pending} onClick={() => flag([r.slug], { hot: !r.hot })} tone="tomato" />
                </td>
                <td>
                  <Link href={`/admin/stories/${r.slug}`} className="text-[12.5px] underline-offset-2 hover:underline" style={{ color: r.story ? "var(--ink)" : "var(--ink-35)" }}>
                    {r.story ? "Written" : "Write"}
                  </Link>
                </td>
                <td style={{ color: r.photo ? "var(--pine)" : "var(--ink-35)" }}>{r.photo ? "Yes" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <p className="py-8 text-center text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            Nothing matches.
          </p>
        )}
      </div>

      {/* Phone: the list */}
      <ul className="mt-4 flex flex-col divide-y lg:hidden" style={{ borderColor: "var(--hairline)" }}>
        {list.map((r) => (
          <li key={r.slug} className="flex items-center gap-3 py-3">
            {writable && <input type="checkbox" checked={picked.has(r.slug)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.slug); else n.delete(r.slug); return n; })} aria-label={`Select ${r.name}`} />}
            <Link href={`/admin/v/${r.slug}`} className="pressable min-w-0 flex-1">
              <p className="serif truncate" style={{ fontSize: 19, lineHeight: 1.1 }}>
                {r.name}
              </p>
              <p className="truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                {neighborhoodName(r.neighborhood)} · {r.kind} · {"$".repeat(r.price)}
                {r.tags.length ? ` · ${r.tags.slice(0, 3).join(" · ")}` : ""}
              </p>
            </Link>
            <span className="flex shrink-0 items-center gap-1.5">
              {r.hot && <Badge tone="tomato">Hot</Badge>}
              <Badge tone={r.verified ? "pine" : "ink"}>{r.verified ? "Verified" : "Draft"}</Badge>
            </span>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-center text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            Nothing matches.
          </li>
        )}
      </ul>
    </main>
  );
}

const inputStyle = { background: "var(--surface)", borderColor: "var(--hairline-strong)", color: "var(--ink)" } as const;

function Th({ label, k, sort, onSort }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void }) {
  const on = sort.key === k;
  return (
    <th>
      <button onClick={() => onSort(k)} className="pressable flex items-center gap-1 uppercase" style={{ color: on ? "var(--ink)" : undefined }}>
        {label}
        {on && <span aria-hidden>{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function Flag({ on, onLabel, offLabel, disabled, onClick, tone }: { on: boolean; onLabel: string; offLabel: string; disabled: boolean; onClick: () => void; tone: "pine" | "tomato" }) {
  const color = tone === "pine" ? "var(--pine)" : "var(--tomato)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pressable rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={on ? { background: color, borderColor: color, color: "var(--on-photo)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-55)" }}
      aria-pressed={on}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function Badge({ tone, children }: { tone: "pine" | "tomato" | "ink"; children: React.ReactNode }) {
  const style = tone === "pine" ? { background: "var(--pine)", color: "var(--on-photo)" } : tone === "tomato" ? { background: "var(--tomato)", color: "var(--on-photo)" } : { background: "rgba(22,33,58,0.08)", color: "var(--ink-55)" };
  return (
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide" style={style}>
      {children}
    </span>
  );
}
