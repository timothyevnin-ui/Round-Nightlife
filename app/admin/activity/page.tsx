import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { getVenues } from "@/lib/db";
import { isEventKind, listEvents, type EventKind, type EventRow } from "@/lib/events";
import { neighborhoodName, isNeighborhoodId } from "@/lib/neighborhoods";
import { listGoTaps } from "@/lib/studio";

export const dynamic = "force-dynamic";

const KINDS: { id: EventKind | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "sayit", label: "Just said" },
  { id: "search", label: "Searches" },
  { id: "results", label: "Results" },
  { id: "view", label: "Opened" },
  { id: "save", label: "Saves" },
  { id: "near", label: "Near me" },
  { id: "go", label: "GO taps" },
];

/** Everything people did, newest first. */
export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const kindParam = typeof sp.kind === "string" ? sp.kind : "all";
  const kind: EventKind | "all" = isEventKind(kindParam) ? kindParam : "all";
  const venues = await getVenues();
  const byName = new Map(venues.map((v) => [v.slug, v.name]));
  const name = (slug: string | null) => (slug ? byName.get(slug) ?? slug : "");

  let rows: EventRow[] = [];
  let problem: string | undefined;
  try {
    rows = kind === "go" ? [] : await listEvents({ kind: kind === "all" ? undefined : kind, limit: 300 });
  } catch (e) {
    problem = e instanceof Error ? e.message : "Couldn't load.";
  }
  if (kind === "all" || kind === "go") {
    const { rows: taps } = await listGoTaps(30, 300);
    rows = [...rows, ...taps.map((t) => ({ id: -t.id, kind: "go" as const, slug: t.slug, q: null, data: {}, user_id: t.user_id, at: t.at }))].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 300);
  }

  return (
    <main className="screen pb-16 pt-6">
      <p className="eyebrow">Activity</p>
      <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }}>
        Everything, in order.
      </h1>
      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        {KINDS.map((k) => (
          <Link key={k.id} href={k.id === "all" ? "/admin/activity" : `/admin/activity?kind=${k.id}`} className="pressable shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium" style={k.id === kind ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" } : { borderColor: "var(--hairline-strong)", color: "var(--ink-70)" }}>
            {k.label}
          </Link>
        ))}
      </div>
      {problem && (
        <p className="mt-4 text-[13.5px]" style={{ color: "var(--tomato-deep)" }}>
          {problem}
        </p>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="studio-table">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={`${e.kind}-${e.id}`}>
                <td className="whitespace-nowrap" style={{ color: "var(--ink-55)" }}>
                  {when(e.at)}
                </td>
                <td className="whitespace-nowrap">
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ background: "var(--ink-6)", color: "var(--ink-70)" }}>
                    {KINDS.find((k) => k.id === e.kind)?.label ?? e.kind}
                  </span>
                </td>
                <td>{detail(e, name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !problem && (
          <p className="py-8 text-center text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            Nothing yet.
          </p>
        )}
      </div>
    </main>
  );
}

function when(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 1) return "just now";
  if (diff < 60) return `${Math.round(diff)}m ago`;
  if (diff < 60 * 24) return `${Math.round(diff / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function detail(e: EventRow, name: (s: string | null) => string): React.ReactNode {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case "sayit":
      return (
        <>
          &ldquo;{e.q}&rdquo;
          <span style={{ color: "var(--ink-55)" }}>
            {" "}
            → {(d.understood as string[] | undefined)?.join(" · ") || "nothing understood"}
            {e.slug ? ` · ${d.near ? "near " : ""}${name(e.slug)}` : ""}
          </span>
        </>
      );
    case "search":
      return (
        <>
          &ldquo;{e.q}&rdquo;
          <span style={{ color: "var(--ink-55)" }}>{d.picked ? ` → opened ${name(e.slug)}` : d.hits === 0 ? " · nothing found" : ` · ${d.hits} found`}</span>
        </>
      );
    case "results": {
      const n = typeof d.neighborhood === "string" ? d.neighborhood : "";
      const hood = isNeighborhoodId(n) ? neighborhoodName(n) : d.mode === "near" ? `Near ${typeof d.at === "string" ? d.at : "them"}` : "";
      const shown = (d.shown as string[] | undefined)?.map(name).slice(0, 3).join(", ");
      return (
        <>
          {String(d.mode)} · {hood}
          {e.q ? ` · ${e.q}` : ""}
          <span style={{ color: "var(--ink-55)" }}>
            {shown ? ` → ${shown}…` : ""}
            {d.engine === "claude" ? ` · Claude${typeof d.heard === "string" && d.heard ? ` heard "${d.heard}"` : ""}` : d.engine === "rules" ? ` · rules${typeof d.note === "string" && d.note ? ` (${d.note})` : ""}` : ""}
          </span>
        </>
      );
    }
    case "view":
      return <Link href={`/admin/v/${e.slug}`} className="underline-offset-2 hover:underline">{name(e.slug)}</Link>;
    case "save":
      return (
        <>
          <Link href={`/admin/v/${e.slug}`} className="underline-offset-2 hover:underline">{name(e.slug)}</Link>
          <span style={{ color: "var(--ink-55)" }}>{d.source ? ` · from ${String(d.source)}` : ""}</span>
        </>
      );
    case "near":
      return (
        <>
          &ldquo;{e.q}&rdquo;
          <span style={{ color: "var(--ink-55)" }}>{e.slug ? ` → at ${name(e.slug)}` : " · address"}</span>
        </>
      );
    case "go":
      return (
        <>
          <Link href={`/admin/v/${e.slug}`} className="underline-offset-2 hover:underline">{name(e.slug)}</Link>
          <span style={{ color: "var(--ink-55)" }}>{e.user_id ? " · signed in" : " · anonymous"}</span>
        </>
      );
    default:
      return e.q ?? e.slug ?? "";
  }
}
