import type { MetadataRoute } from "next";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { OCCASIONS } from "@/lib/occasions";
import { getVenues } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const VENUES = await getVenues();
  return [
    { url: `${SITE}/`, lastModified: now, priority: 1 },
    { url: `${SITE}/hot`, lastModified: now, priority: 0.9 },
    ...VENUES.map((v) => ({ url: `${SITE}/v/${v.slug}`, lastModified: now, priority: 0.7 })),
    ...NEIGHBORHOODS.flatMap((n) => OCCASIONS.map((o) => ({ url: `${SITE}/best/${n.id}/${o.id}`, lastModified: now, priority: 0.8 }))),
  ];
}
