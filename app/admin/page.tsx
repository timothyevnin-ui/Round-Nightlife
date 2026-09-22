import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenuesWithSource } from "@/lib/db";
import { AdminList } from "./AdminList";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const { venues, source, dbCount } = await getVenuesWithSource();
  const { configured, writable } = dbConfig();
  const verified = venues.filter((v) => v.verified).length;

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
          <strong style={{ color: "var(--chalk)" }}>Almost.</strong> The database is connected for reading but <code>SUPABASE_SERVICE_ROLE_KEY</code> is missing, so saving won&apos;t work yet.
        </div>
      )}

      <AdminList venues={venues} source={source} dbCount={dbCount} writable={writable} />

      <p className="mt-10 text-center text-[12px]" style={{ color: "var(--chalk-35)" }}>
        <Link href="/" className="underline">
          Back to ROUND
        </Link>
      </p>
    </main>
  );
}
