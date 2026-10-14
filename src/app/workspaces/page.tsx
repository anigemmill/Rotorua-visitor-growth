import Link from "next/link";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { LogoutButton } from "@/components/platform/LogoutButton";
import { Panel, Pill } from "@/components/platform/ui";
import { STAGE_LABELS } from "@/lib/platform/onboarding";
import { listUserOrganizations } from "@/lib/platform/organizations";
import { MEMBERSHIP_ROLE_LABELS, isPlatformStaff } from "@/lib/platform/permissions";
import { requireUser } from "@/lib/web/session";
import { createWorkspaceAction } from "./actions";

export const metadata = { title: "Your workspaces" };

export default async function WorkspacesPage() {
  const user = await requireUser();
  const memberships = await listUserOrganizations(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-black/50 dark:text-white/50">Signed in as {user.email}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Your workspaces</h1>
        </div>
        <div className="flex items-center gap-4">
          {isPlatformStaff(user.platformRole) && (
            <Link href="/admin" className="text-sm underline">
              Platform admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      {memberships.length > 0 && (
        <ul className="mb-8 divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link href={`/app/${m.organization.slug}`} className="flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <span className="font-medium">{m.organization.name}</span>
                <span className="flex gap-2">
                  <Pill>{MEMBERSHIP_ROLE_LABELS[m.role]}</Pill>
                  <Pill tone={m.organization.onboardingStage === "COMPLETE" ? "good" : "info"}>
                    {STAGE_LABELS[m.organization.onboardingStage]}
                  </Pill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!user.emailVerified ? (
        <Panel title="Confirm your email to get started" description={`We sent a confirmation link to ${user.email}. Once confirmed, you can create your workspace.`}>
          <Link href="/verify-email" className="text-sm font-medium text-teal-700 underline dark:text-teal-400">
            Didn&apos;t get it? Send a new link
          </Link>
        </Panel>
      ) : (
      <Panel
        title={memberships.length ? "Create another workspace" : "Create your business workspace"}
        description="A workspace holds one business's profile, brands, connections and intelligence. Your data is never shared with other workspaces."
      >
        <ActionForm action={createWorkspaceAction}>
          <Field name="name" label="Business name" required placeholder="e.g. Lakeside Adventures" />
          <FormStatus />
          <SubmitButton>Create workspace</SubmitButton>
        </ActionForm>
      </Panel>
      )}
    </div>
  );
}
