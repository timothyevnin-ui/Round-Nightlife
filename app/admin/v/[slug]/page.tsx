import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig, getVenue } from "@/lib/db";
import { VenueForm } from "@/components/admin/VenueForm";

export const dynamic = "force-dynamic";

export default async function EditVenue({ params }: PageProps<"/admin/v/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) notFound();
  return <VenueForm venue={venue} writable={dbConfig().writable} />;
}
