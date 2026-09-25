import { requireAdmin } from "@/lib/adminAuth";
import { getAllVenues } from "@/lib/db";
import { countBy, listProfiles, listReferrals, listSaves, maskPhone } from "@/lib/studio";

export const dynamic = "force-dynamic";

/** Who has an account, and what they've saved. Phones are masked on purpose. */
export default async function PeoplePage() {
  await requireAdmin();
  const [{ rows: profiles, problem }, { rows: saves }, { rows: referrals, problem: refProblem }, venues] = await Promise.all([listProfiles(500), listSaves(5000), listReferrals(), getAllVenues()]);
  const byName = new Map(venues.map((v) => [v.slug, v.name]));
  // Referrals (V28): each person's code, how many joined on it, and who sent them. Ten on a code is $5 owed.
  const refOf = new Map(referrals.map((r) => [r.id, r]));
  const referredCount = new Map<string, number>();
  for (const r of referrals) if (r.referred_by) referredCount.set(r.referred_by, (referredCount.get(r.referred_by) ?? 0) + 1);
  const nameOf = new Map(profiles.map((p) => [p.id, p.name]));
  const owed = profiles.filter((p) => (referredCount.get(p.id) ?? 0) >= 10);
  const savesByUser = new Map<string, { want: number; been: number; loved: number }>();
  for (const s of saves) {
    const c = savesByUser.get(s.user_id) ?? { want: 0, been: 0, loved: 0 };
    if (s.state === "want") c.want++;
    else c.been++;
    if (s.rating === "loved") c.loved++;
    savesByUser.set(s.user_id, c);
  }
  const loved = countBy(saves.filter((s) => s.rating === "loved"), (s) => s.slug, 8);
  const wanted = countBy(saves.filter((s) => s.state === "want"), (s) => s.slug, 8);

  return (
    <main className="screen pb-16 pt-6">
      <p className="eyebrow">People</p>
      <h1 className="serif mt-1" style={{ fontSize: 34, lineHeight: 1.02 }}>
        {profiles.length} {profiles.length === 1 ? "account" : "accounts"}.
      </h1>
      {problem && (
        <p className="mt-3 text-[13.5px]" style={{ color: "var(--tomato-deep)" }}>
          {problem}
        </p>
      )}

      {owed.length > 0 && (
        <section className="card mt-6 p-5" style={{ borderColor: "var(--pine)" }} data-referral-owed>
          <h2 className="serif" style={{ fontSize: 22 }}>
            $5 owed for referrals
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-[14px]">
            {owed.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.name || "(no name yet)"}</span>
                <span style={{ color: "var(--ink-55)" }}> · {referredCount.get(p.id)} joined on {refOf.get(p.id)?.ref_code} · ${5 * Math.floor((referredCount.get(p.id) ?? 0) / 10)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
            Venmo them and keep a note; the count keeps climbing.
          </p>
        </section>
      )}
      {refProblem && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-35)" }}>
          Referrals: {refProblem}
        </p>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="serif" style={{ fontSize: 22 }}>
            Loved
          </h2>
          <List rows={loved.map((r) => ({ label: byName.get(r.key) ?? r.key, n: r.count }))} empty="No ratings yet." />
        </div>
        <div className="card p-5">
          <h2 className="serif" style={{ fontSize: 22 }}>
            Want to go
          </h2>
          <List rows={wanted.map((r) => ({ label: byName.get(r.key) ?? r.key, n: r.count }))} empty="No saves yet." />
        </div>
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="studio-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Joined</th>
              <th>Want</th>
              <th>Been</th>
              <th>Loved</th>
              <th>Code</th>
              <th>Referred</th>
              <th>Sent by</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const c = savesByUser.get(p.id) ?? { want: 0, been: 0, loved: 0 };
              return (
                <tr key={p.id}>
                  <td className="serif text-[16px]">{p.name || <span style={{ color: "var(--ink-35)" }}>(no name yet)</span>}</td>
                  <td style={{ color: "var(--ink-55)" }}>{maskPhone(p.phone)}</td>
                  <td style={{ color: "var(--ink-55)" }}>{new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td>{c.want}</td>
                  <td>{c.been}</td>
                  <td>{c.loved}</td>
                  <td className="tracking-[0.12em]" style={{ color: "var(--ink-55)" }}>{refOf.get(p.id)?.ref_code ?? "—"}</td>
                  <td style={(referredCount.get(p.id) ?? 0) >= 10 ? { color: "var(--pine)", fontWeight: 600 } : undefined}>{referredCount.get(p.id) ?? 0}</td>
                  <td style={{ color: "var(--ink-55)" }}>{refOf.get(p.id)?.referred_by ? nameOf.get(refOf.get(p.id)!.referred_by!) || "someone" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {profiles.length === 0 && !problem && (
          <p className="py-8 text-center text-[13.5px]" style={{ color: "var(--ink-55)" }}>
            Nobody has signed in yet. Accounts appear here the first time someone adds their number.
          </p>
        )}
      </div>
    </main>
  );
}

function List({ rows, empty }: { rows: { label: string; n: number }[]; empty: string }) {
  if (!rows.length)
    return (
      <p className="mt-2 text-[13px]" style={{ color: "var(--ink-35)" }}>
        {empty}
      </p>
    );
  return (
    <ol className="mt-3 flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center justify-between text-[14px]">
          <span>
            <span className="mr-2 text-[12px]" style={{ color: "var(--ink-35)" }}>
              {i + 1}
            </span>
            {r.label}
          </span>
          <span className="font-semibold">{r.n}</span>
        </li>
      ))}
    </ol>
  );
}
