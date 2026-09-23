import { requireAdmin } from "@/lib/adminAuth";
import { getVenues } from "@/lib/db";
import { countBy, listProfiles, listSaves, maskPhone } from "@/lib/studio";

export const dynamic = "force-dynamic";

/** Who has an account, and what they've saved. Phones are masked on purpose. */
export default async function PeoplePage() {
  await requireAdmin();
  const [{ rows: profiles, problem }, { rows: saves }, venues] = await Promise.all([listProfiles(500), listSaves(5000), getVenues()]);
  const byName = new Map(venues.map((v) => [v.slug, v.name]));
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
