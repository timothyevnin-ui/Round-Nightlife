import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenuesWithSource } from "@/lib/db";
import { listSuggestions } from "@/lib/suggestions";
import { AdminList } from "./AdminList";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const { venues, source, dbCount } = await getVenuesWithSource();
  const { configured, writable } = dbConfig();
  const verified = venues.filter((v) => v.verified).length;
  const waiting = writable ? await listSuggestions("new").then((l) => l.length).catch(() => -1) : 0;

  return (
    <main className="screen pb-16">
      <header className="flex items-center justify-between pt-5 pb-2">
        <Wordmark />
        <form action={logout}>
          <button className="pressable text-[12px]" style={{ color: "var(--chalk-35)" }}>
            Sign out
          </button>
        </form>
      </header>

      <section className="pt-5">
        <p className="eyebrow">Back office</p>
        <h1 className="serif mt-1" style={{ fontSize: 38, lineHeight: 1.02 }}>
          {venues.length} places.
          <br />
          <span style={{ color: "var(--chalk-55)" }}>{verified} verified.</span>
        </h1>
      </section>

      {!configured && (
        <div className="card mt-5 p-4 text-[13.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
          <strong style={{ color: "var(--chalk)" }}>Read-only.</strong> You&apos;re looking at the built-in seed. Connect Supabase (see SUPABASE.md) and this becomes editable.
        </div>
      )}
      {configured && !writable && (
        <div className="card mt-5 p-4 text-[13.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
          <strong style={{ color: "var(--chalk)" }}>Almost.</strong> The database is connected for reading but <code>SUPABASE_SECRET_KEY</code> is missing, so saving won&apos;t work yet.
        </div>
      )}

      <Link href="/admin/suggestions" className="pressable card mt-5 flex items-center justify-between p-4">
        <div>
          <p className="text-[15px] font-medium">Recommendations</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-55)" }}>
            {waiting > 0 ? `${waiting} waiting for a look` : waiting === 0 ? "Nothing new. People send these from the home page." : "Run schema.sql again to turn the inbox on."}
          </p>
        </div>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[13px] font-semibold" style={waiting > 0 ? { background: "var(--tomato)", color: "var(--on-photo)" } : { background: "var(--ink-6)", color: "var(--ink-35)" }}>
          {waiting > 0 ? waiting : "→"}
        </span>
      </Link>

      <AdminList venues={venues} source={source} dbCount={dbCount} writable={writable} />

      <p className="mt-10 text-center text-[12px]" style={{ color: "var(--chalk-35)" }}>
        <Link href="/" className="underline">
          Back to ROUND
        </Link>
      </p>
    </main>
  );
}
