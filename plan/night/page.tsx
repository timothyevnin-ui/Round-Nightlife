import type { Metadata } from "next";
import { NightFlow } from "./NightFlow";

export const metadata: Metadata = { title: "Night out" };

export default function Page() {
  return <NightFlow />;
}
