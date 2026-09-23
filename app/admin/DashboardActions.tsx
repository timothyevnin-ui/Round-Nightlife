"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VenueSource } from "@/lib/db";
import { importSeed, importStories, syncSeed } from "./actions";

/** The buttons under the headline: add a place, sync the list, the inbox. */
export function DashboardActions({ writable, source, dbCount, shelfEmpty, waiting }: { writable: boolean; source: VenueSource; dbCount: number; shelfEmpty: boolean; waiting: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<string>) =>
    start(async () => {
      setMsg(await fn());
      router.refresh();
    });

  return (
    <section className="mt-5">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/add" className="pressable btn-primary flex h-11 items-center px-5 text-[14px]">
          + Add a place
        </Link>
        <Link href="/admin/suggestions" className="pressable btn-ghost flex h-11 items-center gap-2 px-4 text-[14px]">
          Recommendations
          {waiting > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold" style={{ background: "var(--tomato)", color: "var(--on-photo)" }}>
              {waiting}
            </span>
          )}
        </Link>
        {writable && source === "seed" && (
          <button
            onClick={() =>
              run(async () => {
                const r = await importSeed();
                return r.ok ? `Imported ${r.slug} places.` : r.error;
              })
            }
            disabled={pending}
            className="pressable btn-ghost flex h-11 items-center px-4 text-[14px]"
          >
            {pending ? "Working…" : "Import the built-in list"}
          </button>
        )}
        {writable && source === "db" && (
          <button
            onClick={() =>
              run(async () => {
                const r = await syncSeed();
                if (!r.ok) return r.error;
                const bits = [`${r.added} added`, `${r.refreshed} refreshed`, r.kept ? `${r.kept} verified left alone` : ""].filter(Boolean).join(" · ");
                const extra = r.missing.length ? ` Not on ROUND's list (yours, or closed): ${r.missing.slice(0, 6).join(", ")}${r.missing.length > 6 ? "…" : ""}.` : "";
                return `Up to date: ${bits}.${extra}`;
              })
            }
            disabled={pending}
            className="pressable btn-ghost flex h-11 items-center px-4 text-[14px]"
          >
            {pending ? "Working…" : "Update from ROUND's list"}
          </button>
        )}
        {writable && source === "db" && shelfEmpty && (
          <button
            onClick={() =>
              run(async () => {
                const r = await importStories();
                return r.ok ? (Number(r.slug) ? `${r.slug} starter stories on the shelf.` : "Nothing to add.") : r.error;
              })
            }
            disabled={pending}
            className="pressable flex h-11 items-center rounded-full border px-4 text-[14px] font-medium"
            style={{ borderColor: "rgba(217,72,43,0.5)", color: "var(--tomato)" }}
          >
            Put the starter stories on the shelf
          </button>
        )}
      </div>
      {msg && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--ink-70)" }}>
          {msg}
        </p>
      )}
      {source === "db" && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--ink-35)" }}>
          Live from the database · {dbCount} rows
        </p>
      )}
    </section>
  );
}
