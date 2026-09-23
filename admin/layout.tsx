import type { Metadata } from "next";
import { isAdmin } from "@/lib/adminAuth";
import { StudioShell } from "./StudioShell";

export const metadata: Metadata = { title: "ROUND Studio", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const signedIn = await isAdmin();
  return <StudioShell signedIn={signedIn}>{children}</StudioShell>;
}
