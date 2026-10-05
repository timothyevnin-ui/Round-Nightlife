"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "./AboutYou";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { CrowdLineRow } from "@/lib/types";

/**
 * People say (V32): one line each, with a first name, where they live and
 * where the place sits on their ladder. Someone you follow gets their rung
 * in tomato and a link to their page. Signed-out, the lines read the same
 * without the tomato.
 */

const VERDICT_WORD = { again: "take me back", back: "would go back", fine: "it was fine", never: "never again" } as const;

function when(iso: string, now: number): string {
  const d = new Date(iso);
  const days = (now - d.getTime()) / 864e5;
  if (days < 1) return "today";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  if (days < 30) return "this month";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function PeopleSay({ lines, slug }: { lines: CrowdLineRow[]; slug: string }) {
  const { enabled, user } = useAuth();
  const [following, setFollowing] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const sb = getSupabase();
    if (!enabled || !user || !sb || !lines.length) return;
    let live = true;
    void sb
      .from("friends")
      .select("friend_id")
      .eq("user_id", user.id)
      .eq("status", "following")
      .then(({ data }) => {
        if (live && data) setFollowing(new Set((data as { friend_id: string }[]).map((r) => r.friend_id)));
      });
    return () => {
      live = false;
    };
  }, [enabled, user, lines.length]);

  if (!lines.length) return null;
  const shown = expanded ? lines : lines.slice(0, 4);
  return (
    <div className="mt-5" data-people-say data-people-say-n={lines.length}>
      <p className="eyebrow">People say</p>
      <ul className="mt-1 divide-y" style={{ borderColor: "var(--hairline)" }}>
        {shown.map((l) => {
          const friend = following.has(l.userId) || (user?.id === l.userId);
          // A rung means something once the ladder has two places on it; before that, the verdict says it better.
          const rung = typeof l.rank === "number" && l.count && (friend || l.count >= 2) ? `#${l.rank}${friend ? ` on ${user?.id === l.userId ? "your" : "their"} ladder` : ` of ${l.count}`}` : l.verdict ? VERDICT_WORD[l.verdict] : null;
          const meta: { text: string; hot?: boolean }[] = [...(l.hometown ? [{ text: l.hometown }] : []), ...(rung ? [{ text: rung, hot: friend }] : []), { text: when(l.at, now) }];
          return (
            <li key={`${l.userId}-${l.at}`} className="flex items-start gap-3 py-3" data-line data-line-friend={friend ? "1" : "0"} data-slug={slug}>
              {friend && user?.id !== l.userId ? (
                <Link href={`/you?follow=${l.userId}`} className="shrink-0">
                  <Avatar url={l.avatar} name={l.name} size={30} />
                </Link>
              ) : (
                <Avatar url={l.avatar} name={l.name} size={30} />
              )}
              <div className="min-w-0 flex-1">
                <p className="serif text-[17px] leading-snug">{l.note}</p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-55)" }}>
                  <span className="font-medium" style={{ color: "var(--ink-70)" }}>
                    {l.name}
                  </span>
                  {meta.map((m, i) => (
                    <span key={i}>
                      {" · "}
                      <span style={m.hot ? { color: "var(--tomato)", fontWeight: 600 } : undefined}>{m.text}</span>
                    </span>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {lines.length > 4 && !expanded && (
        <button onClick={() => setExpanded(true)} className="pressable mt-2 text-[13px] font-medium" style={{ color: "var(--ink-55)" }} data-people-more>
          {lines.length - 4} more
        </button>
      )}
    </div>
  );
}
