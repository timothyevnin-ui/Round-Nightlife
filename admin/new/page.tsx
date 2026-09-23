import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig } from "@/lib/db";
import { getSuggestion, suggestionToDraft } from "@/lib/suggestions";
import { VenueForm, type Prefill } from "@/components/admin/VenueForm";

export const dynamic = "force-dynamic";

export default async function NewVenue(props: PageProps<"/admin/new">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const { writable } = dbConfig();

  let prefill: Prefill | undefined;
  if (from && writable) {
    const s = await getSuggestion(from).catch(() => null);
    if (s) {
      const d = suggestionToDraft(s);
      prefill = {
        suggestionId: s.id,
        name: d.name,
        kind: d.kind,
        neighborhood: d.neighborhood,
        address: d.address,
        notes: d.notes,
        attrs: d.attrs,
        price: d.price,
        easyIn: d.easyIn,
        groupFit: d.groupFit,
        dateFit: d.dateFit,
      };
    }
  }

  return <VenueForm venue={null} writable={writable} prefill={prefill} />;
}
