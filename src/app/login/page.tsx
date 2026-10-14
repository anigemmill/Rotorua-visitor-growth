import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "OPERATOR" ? "/portal" : "/");
  const sp = await searchParams;
  const next = sp.next;
  const setupDone = sp.setup === "done";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-night p-12 text-night-ink lg:flex lg:flex-col lg:justify-between">
        <p className="text-[15px] font-semibold tracking-tight">Outside In<span className="text-brand">.</span></p>
        <div>
          <p className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full bg-lime px-2.5 py-1 text-lime-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />Rotorua Tourism AI Growth Pilot
          </p>
          <h1 className="font-display text-6xl leading-[1.02]">
            Growth you can <em className="italic text-lime">prove.</em>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-night-ink/70">
            The operating system behind the pilot: assessments, roadmaps, the Growth Collective, experiments and evidence — in one place.
          </p>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-3">
          {[["12", "weeks"], ["10", "operators"], ["1", "collective"]].map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-night-line p-3">
              <p className="font-mono text-2xl">{n}</p>
              <p className="eyebrow mt-1 text-night-ink/60">{l}</p>
            </div>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[28px] border-brand/90" />
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="text-[15px] font-semibold">Outside In<span className="text-brand">.</span></p>
          </div>
          <h2 className="font-display text-4xl leading-tight">
            Welcome <em className="mark-lime italic">back</em>
          </h2>
          <p className="mt-1 text-sm text-muted">Sign in to Tourism AI Growth OS.</p>
          {setupDone && <p className="mt-6 rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">Setup complete. Sign in with your new founder account, then remove SETUP_TOKEN from Vercel.</p>}
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
            <LoginForm next={typeof next === "string" ? next : undefined} />
          </div>
          <p className="mt-6 text-xs leading-relaxed text-subtle">
            Access is by invitation. Operators only see their own business information and content the cohort has agreed to share.
          </p>
        </div>
      </section>
    </main>
  );
}
