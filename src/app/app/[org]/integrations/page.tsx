import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice, PageHeader, Panel, Pill, formatDate, type Tone } from "@/components/platform/ui";
import { getConnectionCentre } from "@/lib/platform/connections";
import { limitFor } from "@/lib/platform/entitlements";
import { getLicenseState } from "@/lib/platform/licensing";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { connectWebsiteAction, disconnectAction } from "../actions";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Saved — awaiting first sync", tone: "info" },
  CONNECTED: { label: "Connected", tone: "good" },
  ERROR: { label: "Needs attention", tone: "bad" },
};

export default async function IntegrationsPage({ params }: PageProps<"/app/[org]/integrations">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const [centre, license] = await Promise.all([getConnectionCentre(ctx), getLicenseState(ctx.db)]);
  const canManage = roleCan(ctx.role, "integrations.manage");
  const used = centre.reduce((n, e) => n + e.connections.length, 0);
  const max = limitFor(license.entitlements, "integrations");

  return (
    <>
      <PageHeader
        title="Connections"
        description={
          <>
            Connect the tools your business already uses. Every connection is read-only, requests the minimum permissions, and
            can be disconnected at any time. Using {used} of {max === null ? "unlimited" : max} connections on your plan.
          </>
        }
      />

      <div className="space-y-4">
        {centre.map(({ provider, includedInPlan, connections }) => (
          <Panel key={provider.key}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{provider.name}</h2>
                  {provider.availability === "planned" ? (
                    <Pill>Coming in phase {provider.plannedPhase}</Pill>
                  ) : connections.length ? (
                    <Pill tone="good">Configured</Pill>
                  ) : (
                    <Pill tone="info">Available</Pill>
                  )}
                  {!includedInPlan && <Pill tone="warn">Not in your plan</Pill>}
                </div>
                <p className="mt-1 text-sm">{provider.purpose}</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">{provider.whyItMatters}</p>
              </div>
            </div>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-teal-700 dark:text-teal-400">Permissions, setup and limitations</summary>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Permissions requested</p>
                  <ul className="mt-1 list-disc pl-5 break-words">
                    {provider.permissions.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Setup</p>
                  <ol className="mt-1 list-decimal pl-5">
                    {provider.setupSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Limitations</p>
                  <ul className="mt-1 list-disc pl-5">
                    {provider.limitations.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>

            {connections.length > 0 && (
              <ul className="mt-4 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
                {connections.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{c.externalAccountName ?? c.externalAccountId}</p>
                      <p className="text-xs text-black/55 dark:text-white/55">
                        Added {formatDate(c.connectedAt)} · Last successful sync {formatDate(c.lastSuccessfulSyncAt, true)}
                      </p>
                      {c.lastErrorMessage && <p className="text-xs text-red-600">{c.lastErrorMessage}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <Pill tone={STATUS[c.status]?.tone}>{STATUS[c.status]?.label ?? c.status}</Pill>
                      {canManage && (
                        <ActionForm action={disconnectAction} className="" confirm={`Disconnect ${c.externalAccountId}?`}>
                          <input type="hidden" name="org" value={ctx.organization.slug} />
                          <input type="hidden" name="connectionId" value={c.id} />
                          <SubmitButton variant="secondary">Disconnect</SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {provider.key === "website" && canManage && (
              <div className="mt-4 max-w-md">
                <ActionForm action={connectWebsiteAction} resetOnSuccess>
                  <input type="hidden" name="org" value={ctx.organization.slug} />
                  <Field name="domain" label="Website domain" placeholder="example.co.nz" required />
                  <FormStatus />
                  <SubmitButton>Add website</SubmitButton>
                </ActionForm>
              </div>
            )}
          </Panel>
        ))}
      </div>
      <div className="mt-6">
        <Notice>
          Google, Meta and booking connectors require provider app approval and are released connector by connector after
          their authentication, permissions, error handling and data quality have been tested.
        </Notice>
      </div>
    </>
  );
}
