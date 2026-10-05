import type { Metadata } from "next";
import { isAdmin } from "@/lib/adminAuth";
import { StudioShell } from "./StudioShell";

export const metadata: Metadata = { title: "ROUND Studio", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const signedIn = await isAdmin();
  // The Studio keeps the paper look (V33): the app went night, the back office didn't.
  return (
    <div className="theme-paper" style={{ background: "var(--paper)", minHeight: "100dvh" }}>
      <StudioShell signedIn={signedIn}>{children}</StudioShell>
    </div>
  );
}
