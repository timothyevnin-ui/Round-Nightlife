import type { MetadataRoute } from "next";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { OCCASIONS } from "@/lib/occasions";
import { VENUES } from "@/lib/venues";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, priority: 1 },
    ...VENUES.map((v) => ({ url: `${SITE}/v/${v.slug}`, lastModified: now, priority: 0.7 })),
    ...NEIGHBORHOODS.flatMap((n) => OCCASIONS.map((o) => ({ url: `${SITE}/best/${n.id}/${o.id}`, lastModified: now, priority: 0.8 }))),
  ];
}
