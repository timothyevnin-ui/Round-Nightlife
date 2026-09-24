import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenuesWithSource } from "@/lib/db";
import { listDisputes } from "@/lib/disputes";
import { Disputes, type DisputeCard } from "./Disputes";

export const dynamic = "force-dynamic";

/**
 * Disagreements: what readers say we got wrong, one card each. Confirm and
 * the AI reads it into the place; decline and it's filed. Newest first, the
 * open ones on top.
 */
export default async function DisputesPage() {
  await requireAdmin();
  const { writable } = dbConfig();
  const { venues } = await getVenuesWithSource();
  const bySlug = new Map(venues.map((v) => [v.slug, v]));
  let items: DisputeCard[] = [];
  let problem: string | undefined;
  if (writable) {
    try {
      items = (await listDisputes(undefined, 300)).map((d) => {
        const v = bySlug.get(d.slug);
        return { ...d, name: v?.name ?? d.slug, take: v?.take ?? "", kind: v?.kind ?? "bar" };
      });
    } catch (e) {
      problem = e instanceof Error ? e.message : "Couldn't load them.";
    }
  }
  return <Disputes items={items} writable={writable} problem={problem} />;
}
