import { redirect } from "next/navigation";

/**
 * Retired in V5 ("Add from screenshots"). Kept so an upload replaces the old
 * page; it just sends people to the YOU tab. Safe to delete.
 */
export const dynamic = "force-dynamic";

export default function AddPage() {
  redirect("/you");
}
