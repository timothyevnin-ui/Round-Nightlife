import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig } from "@/lib/db";
import { VenueForm } from "@/components/admin/VenueForm";

export const dynamic = "force-dynamic";

export default async function NewVenue() {
  await requireAdmin();
  return <VenueForm venue={null} writable={dbConfig().writable} />;
}
