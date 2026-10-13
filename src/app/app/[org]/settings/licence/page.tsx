import { ActionForm, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice, PageHeader, Panel, Pill, formatDate } from "@/components/platform/ui";
import { FEATURE_LABELS, LIMIT_LABELS, type FeatureKey, type LimitKey } from "@/lib/platform/entitlements";
import { getLicenseState, listCatalogue } from "@/lib/platform/licensing";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { startTrialAction } from "../../actions";

export default async function LicencePage({ params }: PageProps<"/app/[org]/settings/licence">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const [state, catalogue] = await Promise.all([getLicenseState(ctx.db), listCatalogue()]);
  const canManage = roleCan(ctx.role, "license.manage");
  const l = state.license;

  return (
    <>
      <PageHeader title="Licence & plan" description="What this workspace is licensed to use, and its limits." />

      {l ? (
        <Panel title={`${l.product.name} — ${l.plan.name}`}>
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-black/55 dark:text-white/55">Status</dt>
              <dd>
                <Pill tone={state.access.mode === "full" ? "good" : "warn"}>{l.status.replace("_", " ").toLowerCase()}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-black/55 dark:text-white/55">Access</dt>
              <dd>{state.access.reason}</dd>
            </div>
            <div>
              <dt className="text-black/55 dark:text-white/55">Started</dt>
              <dd>{formatDate(l.startsAt)}</dd>
            </div>
            <div>
              <dt className="text-black/55 dark:text-white/55">{l.trialEndsAt ? "Pilot ends" : "Period ends"}</dt>
              <dd>{formatDate(l.trialEndsAt ?? l.currentPeriodEnd)}</dd>
            </div>
          </dl>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Included</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((f) => (
                  <li key={f} className={state.entitlements.features[f] ? "" : "text-black/35 line-through dark:text-white/35"}>
                    {FEATURE_LABELS[f]}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Limits</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {(Object.keys(LIMIT_LABELS) as LimitKey[]).map((k) => {
                  const v = state.entitlements.limits[k];
                  return (
                    <li key={k}>
                      {v === null ? "Unlimited" : (v ?? 0)} {LIMIT_LABELS[k]}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <p className="mt-5 text-sm text-black/55 dark:text-white/55">
            To change plan, renew or cancel, contact us. Online billing is not connected yet.
          </p>
        </Panel>
      ) : (
        <>
          <div className="mb-6">
            <Notice>This workspace has no licence yet. Start a pilot where available, or contact us about a paid plan.</Notice>
          </div>
          {catalogue.map((product) => (
            <div key={product.id} className="grid gap-4 md:grid-cols-3">
              {product.plans.map((plan) => (
                <Panel key={plan.id} title={plan.name} description={plan.description}>
                  {plan.selfServeTrial && plan.trialDays ? (
                    canManage ? (
                      <ActionForm action={startTrialAction}>
                        <input type="hidden" name="org" value={ctx.organization.slug} />
                        <input type="hidden" name="planKey" value={plan.key} />
                        <FormStatus />
                        <SubmitButton>Start {plan.trialDays}-day pilot</SubmitButton>
                      </ActionForm>
                    ) : (
                      <p className="text-sm text-black/60 dark:text-white/60">Ask a workspace owner to start the pilot.</p>
                    )
                  ) : (
                    <p className="text-sm text-black/60 dark:text-white/60">Contact us to arrange this plan.</p>
                  )}
                </Panel>
              ))}
            </div>
          ))}
        </>
      )}
    </>
  );
}
