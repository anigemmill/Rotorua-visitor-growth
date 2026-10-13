import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PageHeader, Panel } from "@/components/platform/ui";
import { getProfile } from "@/lib/platform/onboarding";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { saveProfileAction } from "../../actions";

const lines = (v: string[] | undefined) => (v ?? []).join("\n");
const TIME_ZONES = Intl.supportedValuesOf("timeZone");

export default async function ProfilePage({ params }: PageProps<"/app/[org]/onboarding/profile">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const p = await getProfile(ctx);
  const canEdit = roleCan(ctx.role, "profile.edit");

  return (
    <>
      <PageHeader
        title="Business profile"
        description="Tell the ecosystem about your business. Only the business name is required — skip anything and come back later. For lists, put one item per line."
      />
      {!canEdit && <p className="mb-4 text-sm text-black/60 dark:text-white/60">You have view-only access. Ask an admin to make changes.</p>}
      <ActionForm action={saveProfileAction}>
        <input type="hidden" name="org" value={ctx.organization.slug} />
        <Panel title="The basics">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="businessName" label="Business name" required defaultValue={p?.businessName} />
            <Field name="website" label="Website" type="url" placeholder="https://" defaultValue={p?.website} />
            <Field name="country" label="Country" defaultValue={p?.country ?? "New Zealand"} />
            <Field
              name="timeZone"
              label="Operating time zone"
              defaultValue={p?.timeZone ?? "Pacific/Auckland"}
              options={TIME_ZONES.map((z) => ({ value: z, label: z }))}
            />
            <Field name="businessType" label="Business type" placeholder="e.g. Tour operator, attraction, accommodation" defaultValue={p?.businessType} />
          </div>
        </Panel>
        <Panel title="What you offer and who it's for">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="products" label="Main products or experiences" multiline defaultValue={lines(p?.products)} />
            <Field name="targetAudiences" label="Target audiences" multiline defaultValue={lines(p?.targetAudiences)} />
            <Field name="mainMarkets" label="Main markets" hint="e.g. Domestic – Auckland, Australia, USA" multiline defaultValue={lines(p?.mainMarkets)} />
            <Field name="competitors" label="Competitors" multiline defaultValue={lines(p?.competitors)} />
          </div>
        </Panel>
        <Panel title="Goals and how you market today">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="objectives" label="Business objectives" multiline defaultValue={lines(p?.objectives)} />
            <Field name="kpis" label="Key performance indicators" hint="e.g. Online bookings, enquiry rate, average order value" multiline defaultValue={lines(p?.kpis)} />
            <Field name="marketingChannels" label="Current marketing channels" multiline defaultValue={lines(p?.marketingChannels)} />
            <Field name="seasonalPriorities" label="Seasonal priorities" multiline defaultValue={p?.seasonalPriorities} />
          </div>
          <div className="mt-4">
            <Field name="constraints" label="Known constraints" hint="Capacity, budget, staffing, consent or cultural considerations the agents must respect." multiline defaultValue={p?.constraints} />
          </div>
        </Panel>
        <FormStatus />
        {canEdit && <SubmitButton>Save business profile</SubmitButton>}
      </ActionForm>
    </>
  );
}
