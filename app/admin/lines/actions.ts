"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/adminAuth";
import { serviceHeaders } from "@/lib/db";

/** Hide one line from a place's page (or show it again). The rating stays; only the words go. */
export async function setLineHidden(userId: string, slug: string, hidden: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) throw new Error("Not signed in.");
  try {
    const { url, headers } = serviceHeaders();
    const res = await fetch(`${url}/rest/v1/saves?user_id=eq.${encodeURIComponent(userId)}&slug=eq.${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ hidden }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, message: `Couldn't save (${res.status}). Run the latest schema.sql first.` };
    revalidatePath("/admin/lines");
    revalidatePath(`/v/${slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't save." };
  }
}
