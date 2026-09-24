import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig } from "@/lib/db";
import { listOwed, listSuggestions, type Suggestion } from "@/lib/suggestions";
import { getSettings } from "@/lib/settings";
import { Inbox } from "./Inbox";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage(props: PageProps<"/admin/suggestions">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const showAll = sp.all === "1";
  const owedOnly = sp.owed === "1";
  const { writable } = dbConfig();
  const { bounty } = await getSettings();

  let items: Suggestion[] = [];
  let problem: string | null = null;
  if (!writable) problem = "Connect Supabase (SUPABASE.md) to receive recommendations.";
  else {
    try {
      items = owedOnly ? await listOwed() : await listSuggestions(showAll ? undefined : "new");
    } catch (e) {
      problem = e instanceof Error ? e.message : "Couldn't load the inbox.";
    }
  }

  return (
    <main className="screen pb-16">
      <header className="sticky top-0 z-30 -mx-5 flex items-center justify-between px-5 py-3 lg:mx-0 lg:px-0" style={{ background: "rgba(243,237,224,0.92)", backdropFilter: "blur(12px)", paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <Link href="/admin" className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M13.5 5 8 11l5.5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="eyebrow">{owedOnly ? "Payouts" : "Recommendations"}</span>
        <span className="flex items-center gap-3">
          <Link href={owedOnly ? "/admin/suggestions" : "/admin/suggestions?owed=1"} className="pressable text-[12.5px] font-medium" style={{ color: "var(--ink-55)" }} data-owed-link>
            {owedOnly ? "Inbox" : "Owed"}
          </Link>
          {!owedOnly && (
            <Link href={showAll ? "/admin/suggestions" : "/admin/suggestions?all=1"} className="pressable text-[12.5px] font-medium" style={{ color: "var(--ink-55)" }}>
              {showAll ? "Only new" : "Show all"}
            </Link>
          )}
        </span>
      </header>

      <section className="pt-5">
        <p className="eyebrow">{owedOnly ? `The $${bounty.amount} offer` : "From the app"}</p>
        <h1 className="serif mt-1" style={{ fontSize: 38, lineHeight: 1.02 }} data-inbox-count={items.length}>
          {problem ? "The inbox." : owedOnly ? (items.length === 0 ? "Nobody's owed." : `${items.length} owed · $${(items.length * bounty.amount).toLocaleString()}.`) : items.length === 0 ? (showAll ? "Nothing yet." : "Inbox zero.") : `${items.length} ${showAll ? "in total" : "waiting"}.`}
        </h1>
        <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
          {owedOnly
            ? `Approved places whose recommender left a Venmo and hasn't been paid. Send the $${bounty.amount}, tap Paid.`
            : "Anyone can send one from Spots → Add a spot. They answer five questions in their own words; add the good ones and the words land in the place's notes, ready for Read my words."}
        </p>
      </section>

      {problem && (
        <div className="card mt-5 p-4 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
          {problem}
        </div>
      )}

      <Inbox items={items} amount={bounty.amount} />
    </main>
  );
}
