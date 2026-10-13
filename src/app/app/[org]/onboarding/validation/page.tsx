import { ActionForm, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice, PageHeader, Panel, Pill } from "@/components/platform/ui";
import { getConnectionCentre } from "@/lib/platform/connections";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { continueFromValidationAction } from "../../actions";

export default async function ValidationPage({ params }: PageProps<"/app/[org]/onboarding/validation">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const centre = await getConnectionCentre(ctx);
  const connected = centre.flatMap((e) => e.connections.map((c) => ({ ...c, provider: e.provider })));

  return (
    <>
      <PageHeader
        title="Validate your data"
        description="Before anything is activated we confirm each connection works, check the data the agents need is actually there, and show you every limitation."
      />
      <div className="mb-6">
        <Notice tone="warn">
          Automated validation checks (permissions, data availability, missing analytics events) run once the Google Analytics,
          Search Console and website connectors are released. Until then, nothing below has been verified — we will not
          claim otherwise.
        </Notice>
      </div>
      <Panel title="Your connections">
        {connected.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No connections yet. Add at least one in Connections.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {connected.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">
                    {c.provider.name} · <span className="font-normal">{c.externalAccountName ?? c.externalAccountId}</span>
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-black/60 dark:text-white/60">
                    {c.provider.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
                <Pill tone="warn">Not yet validated</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {roleCan(ctx.role, "ecosystem.activate") && (
        <div className="mt-6">
          <ActionForm action={continueFromValidationAction}>
            <input type="hidden" name="org" value={ctx.organization.slug} />
            <FormStatus />
            <SubmitButton variant="secondary">I understand these limitations — continue</SubmitButton>
          </ActionForm>
        </div>
      )}
    </>
  );
}
