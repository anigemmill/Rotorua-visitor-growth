import { ActionForm, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice, PageHeader, Panel, Pill, formatDate } from "@/components/platform/ui";
import { formatPrice, PlanSummary } from "@/components/platform/PlanSummary";
import { mergeEntitlements } from "@/lib/platform/entitlements";
import { getLicenseState, listCatalogue } from "@/lib/platform/licensing";
import { roleCan } from "@/lib/platform/permissions";
import { getAiUsageStatus } from "@/lib/platform/usage";
import { UsageMeter } from "@/components/platform/UsageMeter";
import { requireOrg } from "@/lib/web/session";
import { startTrialAction } from "../../actions";

export default async function LicencePage({ params }: PageProps<"/app/[org]/settings/licence">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const [state, catalogue] = await Promise.all([getLicenseState(ctx.db), listCatalogue()]);
  const canManage = roleCan(ctx.role, "license.manage");
  const l = state.license;
  const usage = l ? await getAiUsageStatus(ctx.db, state.entitlements) : null;

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
          {usage && (
            <div className="mt-5 max-w-md">
              <UsageMeter status={usage} />
            </div>
          )}
          <div className="mt-5">
            <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Your plan includes</p>
            <div className="mt-2">
              <PlanSummary e={state.entitlements} showExcluded />
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
                  <p className="mb-3 font-semibold">
                    {formatPrice(plan.priceCents, plan.currency)}{" "}
                    <span className="text-xs font-normal text-black/55 dark:text-white/55">{plan.priceNote}</span>
                  </p>
                  <div className="mb-4">
                    <PlanSummary e={mergeEntitlements(plan.entitlements, null)} />
                  </div>
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
