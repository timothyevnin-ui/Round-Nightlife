import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenuesWithSource } from "@/lib/db";
import { listEvents, topBySlug, topByText, type EventRow } from "@/lib/events";
import { neighborhoodName, isNeighborhoodId } from "@/lib/neighborhoods";
import { countBy, listGoTaps, listProfiles } from "@/lib/studio";
import { listSuggestions } from "@/lib/suggestions";
import { DashboardActions } from "./DashboardActions";
import { DbHealth } from "./DbHealth";
import { checkDatabase, sqlEditorUrl } from "@/lib/health";
import { PICK_MODEL } from "@/lib/pick";

export const dynamic = "force-dynamic";

const DAYS = 7;

export default async function Dashboard() {
  await requireAdmin();
  const { venues, source, dbCount } = await getVenuesWithSource();
  const { configured, writable } = dbConfig();
  const byName = new Map(venues.map((v) => [v.slug, v.name]));
  const name = (slug: string) => byName.get(slug) ?? slug;

  const health = await checkDatabase();
  let ev: EventRow[] = [];
  let evProblem: string | undefined;
  let taps: { slug: string; at: string }[] = [];
  let profileCount = 0;
  let waiting = 0;
  if (writable) {
    const [events, tapsRes, profiles, w] = await Promise.all([
      listEvents({ sinceDays: DAYS, limit: 1000 }).then((rows) => ({ rows }), (e: Error) => ({ rows: [] as EventRow[], problem: e.message })),
      listGoTaps(DAYS),
      listProfiles(1000),
      listSuggestions("new").then((l) => l.length).catch(() => -1),
    ]);
    ev = events.rows;
    evProblem = "problem" in events ? events.problem : undefined;
    taps = tapsRes.rows;
    profileCount = profiles.rows.length;
    waiting = w;
  }

  const verified = venues.filter((v) => v.verified).length;
  const hot = venues.filter((v) => v.hot).length;
  const goTop = countBy(taps, (t) => t.slug, 8);
  const viewTop = topBySlug(ev, "view", 8);
  const saveTop = topBySlug(ev, "save", 8);
  const searches = topByText(
    ev.filter((e) => e.kind === "search" && !(e.data as { picked?: boolean }).picked),
    "search",
    10,
  );
  const misses = ev.filter((e) => e.kind === "search" && (e.data as { hits?: number }).hits === 0);
  const missTop = topByText(misses, "search", 6);
  const sayit = ev.filter((e) => e.kind === "sayit").slice(0, 12);
  const hoods = countBy(
    ev.filter((e) => e.kind === "results"),
    (e) => {
      const n = (e.data as { neighborhood?: string }).neighborhood;
      return isNeighborhoodId(n) ? neighborhoodName(n) : (e.data as { mode?: string }).mode === "near" ? "Near me" : null;
    },
    8,
  );
  const resultEvents = ev.filter((e) => e.kind === "results");
  const results = resultEvents.length;
  const byClaude = resultEvents.filter((e) => (e.data as { engine?: string }).engine === "claude");
  const claudeMs = byClaude.length ? Math.round(byClaude.reduce((a, e) => a + Number((e.data as { ms?: number }).ms ?? 0), 0) / byClaude.length) : 0;
  const claudeOn = !!process.env.ANTHROPIC_API_KEY;

  // Did the pick land? A results page "landed" if one of the places it showed
  // got a GO tap or a save within the next three hours.
  const LANDED_MS = 3 * 3600e3;
  const outcomes = [
    ...ev.filter((e) => e.kind === "save" && e.slug).map((e) => ({ slug: e.slug as string, t: new Date(e.at).getTime() })),
    ...taps.map((t) => ({ slug: t.slug, t: new Date(t.at).getTime() })),
  ];
  const landedOn = (e: EventRow) => {
    const shown = ((e.data as { shown?: string[] }).shown ?? []) as string[];
    const t0 = new Date(e.at).getTime();
    return outcomes.find((o) => shown.includes(o.slug) && o.t >= t0 && o.t <= t0 + LANDED_MS);
  };
  const byRules = resultEvents.filter((e) => (e.data as { engine?: string }).engine !== "claude");
  const landedClaude = byClaude.filter(landedOn).length;
  const landedRules = byRules.filter(landedOn).length;
  const landedTop = countBy(resultEvents.map(landedOn).filter((o): o is { slug: string; t: number } => !!o), (o) => o.slug, 6);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const searchesN = ev.filter((e) => e.kind === "search" && !(e.data as { picked?: boolean }).picked).length;

  return (
    <main className="screen pb-16 pt-6">
      <p className="eyebrow">ROUND Studio</p>
      <h1 className="serif mt-1" style={{ fontSize: 38, lineHeight: 1.02 }}>
        {venues.length} places.
        <br />
        <span style={{ color: "var(--ink-55)" }}>
          {verified} verified · {hot} on the shelf.
        </span>
      </h1>

      {!configured && (
        <div className="card mt-5 p-4 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
          <strong>Read-only.</strong> You&apos;re looking at the built-in list. Connect Supabase (SUPABASE.md) and everything here becomes live.
        </div>
      )}
      {configured && !writable && (
        <div className="card mt-5 p-4 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
          <strong>Almost.</strong> Reading works but <code>SUPABASE_SECRET_KEY</code> is missing, so nothing can be saved or logged.
        </div>
      )}

      <DbHealth health={health} editorUrl={sqlEditorUrl()} />

      <div className="card mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-[13.5px]" style={{ color: "var(--ink-70)" }}>
        <span>
          <strong>Claude {claudeOn ? "is picking" : "is off"}.</strong>{" "}
          {claudeOn ? (
            <>
              Every results page goes through <code>{PICK_MODEL}</code> with the whole catalog. {byClaude.length}/{results} results in the last {DAYS} days{byClaude.length ? `, ${(claudeMs / 1000).toFixed(1)}s average` : ""}.
            </>
          ) : (
            <>
              Add <code>ANTHROPIC_API_KEY</code> in Vercel → Settings → Environment Variables and redeploy; until then the rules engine picks.
            </>
          )}
        </span>
      </div>

      <DashboardActions writable={writable} source={source} dbCount={dbCount} shelfEmpty={hot === 0} waiting={waiting} />

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat n={taps.length} label={`GO taps · ${DAYS}d`} />
        <Stat n={results} label={`Results shown · ${DAYS}d`} />
        <Stat n={searchesN} label={`Searches · ${DAYS}d`} />
        <Stat n={profileCount} label="Accounts" />
      </section>

      {evProblem && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--tomato-deep)" }}>
          {evProblem}
        </p>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Most tapped GO" hint={`Last ${DAYS} days`}>
          <Ranked rows={goTop.map((r) => ({ label: name(r.key), href: `/admin/v/${r.key}`, n: r.count }))} empty="No GO taps yet." />
        </Panel>
        <Panel title="Most opened" hint="Venue pages">
          <Ranked rows={viewTop.map((r) => ({ label: name(r.slug), href: `/admin/v/${r.slug}`, n: r.count }))} empty="Nothing opened yet." />
        </Panel>
        <Panel title="Most saved" hint="Want to go">
          <Ranked rows={saveTop.map((r) => ({ label: name(r.slug), href: `/admin/v/${r.slug}`, n: r.count }))} empty="No saves yet." />
        </Panel>
        <Panel title="Where people ask about" hint="Neighborhood on results">
          <Ranked rows={hoods.map((r) => ({ label: r.key, n: r.count }))} empty="No results shown yet." />
        </Panel>
        <Panel title="What people search" hint="Top phrases">
          <Ranked rows={searches.map((r) => ({ label: r.q, n: r.count }))} empty="No searches yet." />
          {missTop.length > 0 && (
            <div className="mt-4">
              <p className="eyebrow" style={{ color: "var(--tomato)" }}>
                Searched, not on ROUND
              </p>
              <div className="mt-2">
                <Ranked rows={missTop.map((r) => ({ label: r.q, n: r.count }))} empty="" />
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Did the pick land?" hint="A GO tap or a save within 3 hours of the results">
          {results === 0 ? (
            <Empty>No results shown yet.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="stat">
                  <p className="n">{pct(landedClaude, byClaude.length)}</p>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--ink-55)" }}>
                    Claude&apos;s picks · {landedClaude} of {byClaude.length}
                  </p>
                </div>
                <div className="stat">
                  <p className="n">{pct(landedRules, byRules.length)}</p>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--ink-55)" }}>
                    Rules only · {landedRules} of {byRules.length}
                  </p>
                </div>
              </div>
              {landedTop.length > 0 && (
                <div className="mt-4">
                  <p className="eyebrow">Picks that landed</p>
                  <div className="mt-2">
                    <Ranked rows={landedTop.map((r) => ({ label: name(r.key), href: `/admin/v/${r.key}`, n: r.count }))} empty="" />
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
        <Panel title="Just said" hint="Latest, with what we understood">
          {sayit.length === 0 ? (
            <Empty>Nothing typed yet.</Empty>
          ) : (
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
              {sayit.map((e) => {
                const d = e.data as { understood?: string[]; engine?: string; near?: boolean };
                return (
                  <li key={e.id} className="py-2.5">
                    <p className="text-[14px]">&ldquo;{e.q}&rdquo;</p>
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--ink-55)" }}>
                      {(d.understood ?? []).join(" · ") || "nothing understood"}
                      {e.slug ? ` · ${d.near ? "near " : ""}${name(e.slug)}` : ""}
                      {d.engine ? ` · ${d.engine}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      <p className="mt-10 text-[12px]" style={{ color: "var(--ink-35)" }}>
        <Link href="/admin/activity" className="underline">
          Everything, in order →
        </Link>
      </p>
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <p className="n">{n}</p>
      <p className="mt-1 text-[12px]" style={{ color: "var(--ink-55)" }}>
        {label}
      </p>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>
          {title}
        </h2>
        {hint && (
          <span className="text-[11.5px]" style={{ color: "var(--ink-35)" }}>
            {hint}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Ranked({ rows, empty }: { rows: { label: string; href?: string; n: number }[]; empty: string }) {
  if (!rows.length) return empty ? <Empty>{empty}</Empty> : null;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-right text-[12px]" style={{ color: "var(--ink-35)" }}>
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            {r.href ? (
              <Link href={r.href} className="block truncate text-[14px] underline-offset-2 hover:underline">
                {r.label}
              </Link>
            ) : (
              <p className="truncate text-[14px]">{r.label}</p>
            )}
            <div className="mt-1 h-1 rounded-full" style={{ background: "var(--ink-6)" }}>
              <div className="h-1 rounded-full" style={{ width: `${Math.max(6, (r.n / max) * 100)}%`, background: "var(--tomato)" }} />
            </div>
          </div>
          <span className="w-8 shrink-0 text-right text-[13px] font-semibold">{r.n}</span>
        </li>
      ))}
    </ol>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px]" style={{ color: "var(--ink-35)" }}>
      {children}
    </p>
  );
}
