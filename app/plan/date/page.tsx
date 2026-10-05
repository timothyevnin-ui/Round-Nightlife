import { redirect } from "next/navigation";

/** Bars only (V33): this door is gone; the ask on the home page handles it. */
export default function Page() {
  redirect("/");
}
