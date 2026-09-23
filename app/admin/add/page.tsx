import { requireAdmin } from "@/lib/adminAuth";
import { dbConfig } from "@/lib/db";
import { AddFlow } from "./AddFlow";

export const dynamic = "force-dynamic";

/** Add a place by answering the questions, one at a time. The full form is still at /admin/new. */
export default async function AddPlace() {
  await requireAdmin();
  const { writable } = dbConfig();
  return <AddFlow writable={writable} />;
}
