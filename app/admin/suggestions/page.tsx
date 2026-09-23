import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig } from "@/lib/db";
import { listSuggestions, type Suggestion } from "@/lib/suggestions";
import { Inbox } from "./Inbox";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage(props: PageProps<"/admin/suggestions">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const showAll = sp.all === "1";
  const { writable } = dbConfig();

  let items: Suggestion[] = [];
  let problem: string | null = null;
  if (!writable) problem = "Connect Supabase (SUPABASE.md) to receive recommendations.";
  else {
    try {
      items = await listSuggestions(showAll ? undefined : "new");
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
        <span className="eyebrow">Recommendations</span>
        <Link href={showAll ? "/admin/suggestions" : "/admin/suggestions?all=1"} className="pressable text-[12.5px] font-medium" style={{ color: "var(--ink-55)" }}>
          {showAll ? "Only new" : "Show all"}
        </Link>
      </header>

      <section className="pt-5">
        <p className="eyebrow">From the app</p>
        <h1 className="serif mt-1" style={{ fontSize: 38, lineHeight: 1.02 }}>
          {problem ? "The inbox." : items.length === 0 ? (showAll ? "Nothing yet." : "Inbox zero.") : `${items.length} ${showAll ? "in total" : "waiting"}.`}
        </h1>
        <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--ink-55)" }}>
          Anyone can send one from &ldquo;Know a spot we don&apos;t?&rdquo; on the home page. Add the good ones; they land in the form with the answers filled in.
        </p>
      </section>

      {problem && (
        <div className="card mt-5 p-4 text-[13.5px] leading-snug" style={{ color: "var(--ink-70)" }}>
          {problem}
        </div>
      )}

      <Inbox items={items} />
    </main>
  );
}
