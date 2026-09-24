import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenuesWithSource } from "@/lib/db";
import { PlacesTable, type PlaceRow } from "./PlacesTable";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  await requireAdmin();
  const { venues, source } = await getVenuesWithSource();
  const { writable } = dbConfig();
  const rows: PlaceRow[] = venues.map((v) => ({
    slug: v.slug,
    name: v.name,
    neighborhood: v.neighborhood,
    kind: v.kind,
    price: v.price,
    verified: v.verified,
    retired: !!v.retired,
    hot: !!v.hot,
    hotRank: v.hotRank ?? null,
    story: !!v.story,
    photo: !!v.photoUrl,
    tags: v.tags,
  }));
  return <PlacesTable rows={rows} writable={writable && source === "db"} />;
}
