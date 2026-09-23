"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCHEMA_SQL } from "@/lib/schemaSql";
import type { Health } from "@/lib/health";

/**
 * The one card that explains every "it didn't save" at once. When the
 * database is behind the code, it lists what's missing, copies the SQL, and
 * opens the SQL editor.
 */
export function DbHealth({ health, editorUrl }: { health: Health; editorUrl: string | null }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  if (!health.writable) return null;
  const missing = health.missing;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this SQL:", SCHEMA_SQL);
    }
  };

  if (missing.length === 0) {
    return (
      <p className="mt-4 text-[12.5px]" style={{ color: "var(--pine)" }}>
        Database is up to date: every table and column this version needs is there.
      </p>
    );
  }

  return (
    <section className="mt-5 rounded-[22px] border p-5" style={{ borderColor: "rgba(217,72,43,0.5)", background: "rgba(217,72,43,0.06)" }}>
      <p className="eyebrow" style={{ color: "var(--tomato)" }}>
        The database needs an update
      </p>
      <h2 className="serif mt-1" style={{ fontSize: 24, lineHeight: 1.1 }}>
        {missing.length === 1 ? "One thing" : `${missing.length} things`} the code expects {missing.length === 1 ? "isn't" : "aren't"} there yet.
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
        {missing.map((m) => (
          <li key={m.key} className="flex items-baseline gap-2">
            <span aria-hidden style={{ color: "var(--tomato)" }}>
              ✕
            </span>
            <span>
              <strong>{m.label}</strong>
              <span style={{ color: "var(--ink-55)" }}>
                {" "}
                · {m.what}
                {m.detail ? ` (${m.detail})` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
        Anything on that list fails quietly in the app (a recommendation that won&apos;t send, a photo that won&apos;t save). The fix is one paste: copy the SQL, open the editor, paste, Run. It only adds what&apos;s missing; nothing is lost. Then come back and check again.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={copy} className="pressable btn-primary flex h-11 items-center px-5 text-[14px]">
          {copied ? "Copied" : "1 · Copy the SQL"}
        </button>
        {editorUrl && (
          <a href={editorUrl} target="_blank" rel="noreferrer" className="pressable btn-accent flex h-11 items-center px-5 text-[14px]">
            2 · Open the SQL editor
          </a>
        )}
        <button onClick={() => router.refresh()} className="pressable btn-ghost flex h-11 items-center px-4 text-[14px]">
          3 · Check again
        </button>
      </div>
    </section>
  );
}
