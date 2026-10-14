import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActionForm, Notice, TextField } from "@/components/ui";
import { setupAvailable } from "@/lib/setup";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { runSetup } from "./actions";

export const metadata: Metadata = { title: "First-run setup" };

export default async function SetupPage() {
  // Must be evaluated per request (env + user count), never prerendered.
  await connection();
  // Invisible once a user exists or when SETUP_TOKEN is not configured.
  if (!(await setupAvailable())) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-[15px] font-semibold">Outside In<span className="text-brand">.</span></p>
        <h1 className="font-display mt-6 text-4xl leading-tight">
          First-run <em className="mark-lime italic">setup</em>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Creates the founder account and the programme skeleton (12-week programme, templates, workflow library). No demo data. This page disappears once it has been used.
        </p>
        <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <ActionForm action={runSetup} submitLabel="Create founder account">
            <TextField name="token" label="Setup token" type="password" required autoComplete="off" hint="The SETUP_TOKEN value you set in Vercel." />
            <TextField name="name" label="Your name" required autoComplete="name" />
            <TextField name="email" label="Email" type="email" required autoComplete="username" />
            <TextField name="password" label="Password" type="password" required autoComplete="new-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
            <TextField name="confirm" label="Confirm password" type="password" required autoComplete="new-password" />
            <TextField name="programmeStart" label="Programme start date (week 1)" type="date" hint="Optional — editable later." />
          </ActionForm>
        </div>
        <div className="mt-4">
          <Notice tone="info">After setup, remove SETUP_TOKEN from Vercel. Setup stays locked regardless while any user exists.</Notice>
        </div>
      </div>
    </main>
  );
}
