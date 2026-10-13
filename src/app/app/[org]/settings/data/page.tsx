import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PageHeader, Panel } from "@/components/platform/ui";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { requestDeletionAction } from "../../actions";

export default async function DataPage({ params }: PageProps<"/app/[org]/settings/data">) {
  const { org } = await params;
  const ctx = await requireOrg(org);

  return (
    <>
      <PageHeader title="Data & privacy" description="How your data is held, and how to take it with you or delete it." />
      <div className="space-y-6">
        <Panel title="How we handle your data">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Your workspace&apos;s data is isolated from every other customer and is never used to configure another workspace.</li>
            <li>Integrations are read-only and request the minimum permissions. Disconnecting deletes stored credentials immediately.</li>
            <li>Connection credentials are encrypted at rest and are never sent to your browser or to an AI model.</li>
            <li>We avoid importing traveller personal information; booking data uses pseudonymous references where possible.</li>
          </ul>
        </Panel>
        <Panel title="Export" description="A full export of your workspace data will be available here. Until then, contact support for an export." >
          <p className="text-sm text-black/55 dark:text-white/55">Self-service export ships with the shared data layer (Phase 2).</p>
        </Panel>
        {roleCan(ctx.role, "org.delete") && (
          <Panel
            title="Delete this workspace"
            description="Disconnects all integrations and permanently deletes the workspace's data after a review period. This cannot be undone."
          >
            <ActionForm action={requestDeletionAction} confirm="Request permanent deletion of this workspace?">
              <input type="hidden" name="org" value={ctx.organization.slug} />
              <Field name="confirmName" label={`Type "${ctx.organization.name}" to confirm`} required />
              <FormStatus />
              <SubmitButton variant="danger">Request deletion</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
