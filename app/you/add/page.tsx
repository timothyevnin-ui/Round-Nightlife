import type { Metadata } from "next";
import { AddView } from "./AddView";

export const metadata: Metadata = { title: "Add from screenshots" };

export default function AddPage() {
  return <AddView />;
}
