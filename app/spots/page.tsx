import type { Metadata } from "next";
import { TabBar } from "@/components/TabBar";
import { getVenues } from "@/lib/db";
import { crowdScores } from "@/lib/crowd";
import type { Crowd } from "@/components/Score";
import { SpotsView, type Spot } from "./SpotsView";

export const revalidate = 60;

export const metadata: Metadata = { title: "Spots", description: "Every place on ROUND: the take, the score, and your say." };

/**
 * The Spots tab: every place ROUND stands behind, on a map first (with you on
 * it, when you allow it) and as a list. The take and the score up front;
 * Want to go, Been, Rate and Disagree on every pin and every row.
 */
export default async function SpotsPage() {
  const venues = await getVenues();
  const crowd: Record<string, Crowd> = await crowdScores().catch(() => ({}));
  const spots: Spot[] = venues.map((v) => ({
    slug: v.slug,
    name: v.name,
    kind: v.kind,
    barFood: !!v.barFood,
    cuisine: v.cuisine ?? null,
    neighborhood: v.neighborhood,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    take: v.take,
    hours: v.hours ?? null,
    tags: v.tags.slice(0, 3),
    price: v.price,
    score: v.score ?? null,
    verified: !!v.verified,
    desk: !!v.sources?.includes("desk"),
    hot: !!v.hot,
    photo: v.photo,
    photoUrl: v.photoUrl,
    crowd: crowd[v.slug] ? { n: crowd[v.slug].n, back: crowd[v.slug].back } : null,
  }));
  return (
    <>
      <SpotsView spots={spots} />
      <TabBar />
    </>
  );
}
