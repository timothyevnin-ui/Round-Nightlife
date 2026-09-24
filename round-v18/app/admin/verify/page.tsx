import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenuesWithSource } from "@/lib/db";
import { Sprint, type SprintCard } from "./Sprint";

export const dynamic = "force-dynamic";

/**
 * The verify sprint: every unverified place, one at a time, three big
 * buttons. Built for a phone in one hand. What you say about a place is read
 * into its fields in the background while you're already on the next one.
 */
export default async function VerifyPage() {
  await requireAdmin();
  const { venues, source } = await getVenuesWithSource();
  const { writable } = dbConfig();
  const live = venues.filter((v) => !v.retired);
  const cards: SprintCard[] = live
    .filter((v) => !v.verified)
    .map((v) => ({
      slug: v.slug,
      name: v.name,
      neighborhood: v.neighborhood,
      kind: v.kind,
      cuisine: v.cuisine ?? null,
      address: v.address,
      price: v.price,
      take: v.take,
      theCatch: v.theCatch ?? null,
      tags: v.tags,
      score: v.score ?? null,
      photoUrl: v.photoUrl ?? null,
      photo: v.photo,
    }));
  return <Sprint cards={cards} verified={live.length - cards.length} total={live.length} writable={writable && source === "db"} />;
}
