"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/adminAuth";
import { cleanQuestion } from "@/lib/crowdQuestions";
import { getPoolAll, refreshQuestions, savePoolRows } from "@/lib/pool";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not signed in.");
}

/** The AI reads the asks and rewrites the pool. */
export async function refreshPool(): Promise<{ ok: boolean; message: string }> {
  await guard();
  try {
    const r = await refreshQuestions();
    revalidatePath("/admin/questions");
    if (r.error) return { ok: false, message: r.error };
    return { ok: true, message: `Read ${r.asks} asks. ${r.changed} question${r.changed === 1 ? "" : "s"} written or changed, ${r.retired} retired.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't refresh." };
  }
}

/** Retire a question (it stops being asked; its answers stay), or bring it back. */
export async function setQuestionActive(id: string, active: boolean): Promise<{ ok: boolean; message?: string }> {
  await guard();
  const { pool } = await getPoolAll(true);
  const q = pool.find((x) => x.id === id);
  if (!q) return { ok: false, message: "No such question." };
  try {
    await savePoolRows([{ ...q, active }]);
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't save." };
  }
}

/** Reword a question's prompt (your words win; the AI's next pass keeps your prompt). */
export async function rewordQuestion(id: string, prompt: string, sub: string): Promise<{ ok: boolean; message?: string }> {
  await guard();
  const { pool } = await getPoolAll(true);
  const q = pool.find((x) => x.id === id);
  if (!q) return { ok: false, message: "No such question." };
  const next = cleanQuestion({ ...q, prompt, sub: sub || undefined, ai: false });
  if (!next) return { ok: false, message: "That prompt won't do." };
  try {
    await savePoolRows([next]);
    revalidatePath("/admin/questions");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't save." };
  }
}
