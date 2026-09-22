import { redirect } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { adminPin, isAdmin } from "@/lib/adminAuth";
import { LoginForm } from "./LoginForm";

export default async function AdminLogin() {
  if (await isAdmin()) redirect("/admin");
  const configured = !!adminPin();
  return (
    <main className="screen flex flex-col" style={{ minHeight: "100dvh" }}>
      <header className="pt-5">
        <Wordmark />
      </header>
      <section className="flex flex-1 flex-col justify-center pb-24">
        <p className="eyebrow">Back office</p>
        <h1 className="serif mt-2" style={{ fontSize: 40, lineHeight: 1.02 }}>
          Your opinions go here.
        </h1>
        {configured ? (
          <LoginForm />
        ) : (
          <div className="card mt-8 p-5 text-[14.5px] leading-snug" style={{ color: "var(--chalk-70)" }}>
            Set <code>ROUND_ADMIN_PIN</code> in the deployment&apos;s environment variables (any PIN you&apos;ll remember), redeploy, and this door opens.
          </div>
        )}
      </section>
    </main>
  );
}
