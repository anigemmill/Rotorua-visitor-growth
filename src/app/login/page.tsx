import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "OPERATOR" ? "/portal" : "/");
  const next = (await searchParams).next;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Outside In</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Tourism AI Growth OS</h1>
          <p className="mt-1 text-sm text-muted">Rotorua Tourism AI Growth Pilot</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-subtle">
          Access is by invitation. Operators only see their own business information and content the cohort has
          agreed to share.
        </p>
      </div>
    </main>
  );
}
