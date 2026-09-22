import type { Metadata } from "next";
import { DateFlow } from "./DateFlow";

export const metadata: Metadata = { title: "Date" };

export default function Page() {
  return <DateFlow />;
}
