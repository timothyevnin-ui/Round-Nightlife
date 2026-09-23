import type { Metadata } from "next";
import { NearView } from "./NearView";

export const metadata: Metadata = { title: "Near me" };

export default function Page() {
  return <NearView />;
}
