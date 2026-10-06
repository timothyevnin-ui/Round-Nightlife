"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PlaceHit, ResolvedPlace } from "@/lib/placesSearch";

/**
 * Start typing a bar, tap it, done (V35). A text box that asks /api/places
 * as you type (250ms behind your thumb) and lists what it finds: bars by
 * name first, then street addresses. Picking one hands back the proper
 * name, the address and the pin. Typing past the list and ignoring it still
 * works: the words are the value, as before.
 */
export function PlaceSearch({
  value,
  onChange,
  onPick,
  placeholder = "The name",
  autoFocus,
  className = "",
  style,
  inputClassName = "",
  inputStyle,
  testId = "place-search",
}: {
  value: string;
  onChange: (text: string) => void;
  onPick: (place: ResolvedPlace, hit: PlaceHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  style?: CSSProperties;
  inputClassName?: string;
  inputStyle?: CSSProperties;
  testId?: string;
}) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const [session] = useState(() => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
  const typed = useRef(value);
  const picked = useRef<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  // Ask as they type, a beat behind; never for the thing they just picked.
  useEffect(() => {
    typed.current = value;
    if (!open) return;
    if (value.trim().length < 2 || value === picked.current) {
      setHits([]);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      setBusy(true);
      fetch(`/api/places?q=${encodeURIComponent(value.trim())}&s=${session}`)
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((j: { hits?: PlaceHit[] }) => {
          if (!live || typed.current !== value) return;
          setHits(Array.isArray(j.hits) ? j.hits : []);
          setActive(-1);
        })
        .catch(() => live && setHits([]))
        .finally(() => live && setBusy(false));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [value, open, session]);

  // Tap outside: the list goes away.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pick = async (h: PlaceHit) => {
    setOpen(false);
    setHits([]);
    picked.current = h.name;
    onChange(h.name);
    try {
      const r = await fetch(`/api/places?id=${encodeURIComponent(h.id)}&s=${session}`);
      const j = (await r.json()) as { place?: ResolvedPlace };
      if (j.place) {
        picked.current = j.place.name || h.name;
        onPick(j.place, h);
      }
    } catch {
      /* the name alone is still a fine answer */
    }
  };

  return (
    <div ref={box} className={`relative ${className}`} style={style} data-place-search={testId}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            void pick(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={inputClassName}
        style={inputStyle}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={`${testId}-list`}
        aria-autocomplete="list"
        data-place-input
      />
      {open && (hits.length > 0 || busy) && (
        <ul className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-[18px] border" style={{ background: "var(--surface)", borderColor: "var(--hairline-strong)", boxShadow: "0 18px 40px -16px rgba(0,0,0,0.45)" }} role="listbox" id={`${testId}-list`} data-place-list>
          {hits.map((h, i) => (
            <li key={h.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(h)}
                className="pressable flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                style={{ background: i === active ? "var(--ink-6)" : "transparent", borderTop: i ? "1px solid var(--hairline)" : "none" }}
                role="option"
                aria-selected={i === active}
                data-place-hit={h.kind}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: h.kind === "place" ? "var(--tomato)" : "var(--ink-10)", color: h.kind === "place" ? "var(--on-photo)" : "var(--ink-55)" }} aria-hidden>
                  {h.kind === "place" ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                    {h.name}
                  </span>
                  {h.secondary && (
                    <span className="block truncate text-[12px]" style={{ color: "var(--ink-55)" }}>
                      {h.secondary}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {busy && !hits.length && (
            <li className="px-3.5 py-2.5 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
              Looking…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
