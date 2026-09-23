import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenue, getVenuesWithSource } from "@/lib/db";
import { StoryEditor } from "./StoryEditor";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: PageProps<"/admin/stories/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const v = await getVenue(slug);
  if (!v) notFound();
  const { source } = await getVenuesWithSource();
  return <StoryEditor slug={v.slug} name={v.name} take={v.take} story={v.story ?? ""} hot={!!v.hot} hotRank={v.hotRank ?? null} photoUrl={v.photoUrl} writable={dbConfig().writable && source === "db"} />;
}
