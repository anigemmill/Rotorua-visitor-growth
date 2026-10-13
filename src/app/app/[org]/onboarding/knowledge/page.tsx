import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice, PageHeader, Panel } from "@/components/platform/ui";
import { getProfile } from "@/lib/platform/onboarding";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { saveKnowledgeAction } from "../../actions";

export default async function KnowledgePage({ params }: PageProps<"/app/[org]/onboarding/knowledge">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const p = await getProfile(ctx);
  const canEdit = roleCan(ctx.role, "profile.edit");

  return (
    <>
      <PageHeader
        title="Business knowledge"
        description="How you describe yourself and what the agents must never say. This shapes every brief, recommendation and content plan."
      />
      <div className="mb-6">
        <Notice>
          This knowledge belongs to this workspace only. It is never used to configure, train or inform any other customer&apos;s
          ecosystem.
        </Notice>
      </div>
      <ActionForm action={saveKnowledgeAction}>
        <input type="hidden" name="org" value={ctx.organization.slug} />
        <Panel title="Positioning and messaging">
          <div className="space-y-4">
            <Field name="positioning" label="Brand positioning" multiline rows={3} defaultValue={p?.positioning} />
            <Field name="uniqueSellingPoints" label="Unique selling points" hint="One per line." multiline defaultValue={(p?.uniqueSellingPoints ?? []).join("\n")} />
            <Field name="approvedMessaging" label="Approved messaging" hint="Taglines, claims and descriptions you're happy for the agents to reuse." multiline rows={4} defaultValue={p?.approvedMessaging} />
            <Field name="toneOfVoice" label="Tone and style" multiline defaultValue={p?.toneOfVoice} />
            <Field name="pricingNotes" label="Pricing information" hint="Only what you're comfortable for the agents to reference." multiline defaultValue={p?.pricingNotes} />
          </div>
        </Panel>
        <Panel title="Guardrails">
          <div className="space-y-4">
            <Field name="brandRestrictions" label="Brand restrictions" hint="Words, claims, imagery or topics to avoid." multiline rows={4} defaultValue={p?.brandRestrictions} />
            <Field
              name="culturalGuidelines"
              label="Cultural and factual guidelines"
              hint="e.g. correct use of te reo Māori and place names, stories that must only be told with permission, facts that must be stated precisely."
              multiline
              rows={4}
              defaultValue={p?.culturalGuidelines}
            />
          </div>
        </Panel>
        <FormStatus />
        {canEdit && <SubmitButton>Save business knowledge</SubmitButton>}
      </ActionForm>
      <p className="mt-6 text-sm text-black/55 dark:text-white/55">
        Uploading approved reference documents (brand books, fact sheets) arrives with document storage in a later release.
      </p>
    </>
  );
}
