import Link from "next/link";
import { ButtonLink, PageHeader, Panel, Pill, Stat, formatDate } from "@/components/platform/ui";
import { AGENTS } from "@/lib/agents/registry";
import { getLicenseState } from "@/lib/platform/licensing";
import { STAGE_LABELS, STAGE_ORDER, stageIndex } from "@/lib/platform/onboarding";
import { requireOrg } from "@/lib/web/session";

const STAGE_LINKS: Record<string, string> = {
  BUSINESS_PROFILE: "onboarding/profile",
  BUSINESS_KNOWLEDGE: "onboarding/knowledge",
  INTEGRATIONS: "integrations",
  VALIDATION: "onboarding/validation",
  ACTIVATION: "onboarding/activation",
};

export default async function OverviewPage({ params }: PageProps<"/app/[org]">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const [license, connections, brands] = await Promise.all([
    getLicenseState(ctx.db),
    ctx.db.integrationConnection.count({ where: { status: { not: "REVOKED" } } }),
    ctx.db.brand.count(),
  ]);
  const base = `/app/${ctx.organization.slug}`;
  const current = stageIndex(ctx.organization.onboardingStage);
  const nextStage = STAGE_ORDER[current];

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your intelligence ecosystem's setup and status. Reports and prioritised actions appear here once agents are activated."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Licence"
          value={license.license ? license.license.plan.name : "None"}
          sub={license.license ? license.access.reason : "Start a pilot to begin"}
        />
        <Stat label="Data connections" value={connections} />
        <Stat label="Brands" value={brands} />
        <Stat
          label="Agents live"
          value={`0 of ${AGENTS.length}`}
          sub="Agent workflows are released from Phase 3"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Setup progress" className="lg:col-span-2">
          <ol className="space-y-2">
            {STAGE_ORDER.filter((s) => s !== "COMPLETE").map((stage, i) => {
              const done = i < current;
              const isNext = i === current;
              return (
                <li key={stage} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 dark:border-white/10">
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        done ? "bg-teal-700 text-white" : isNext ? "border-2 border-teal-700 text-teal-700" : "border border-black/20 text-black/40 dark:border-white/20"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={done ? "text-black/60 dark:text-white/60" : "font-medium"}>{STAGE_LABELS[stage]}</span>
                  </span>
                  <Link href={`${base}/${STAGE_LINKS[stage]}`} className="text-sm text-teal-700 underline dark:text-teal-400">
                    {done ? "Review" : isNext ? "Continue" : "Open"}
                  </Link>
                </li>
              );
            })}
          </ol>
          {nextStage && nextStage !== "COMPLETE" && (
            <div className="mt-4">
              <ButtonLink href={`${base}/${STAGE_LINKS[nextStage]}`}>Continue: {STAGE_LABELS[nextStage]}</ButtonLink>
            </div>
          )}
        </Panel>

        <Panel title="Licence">
          {license.license ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-black/60 dark:text-white/60">Plan</dt>
                <dd>{license.license.plan.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-black/60 dark:text-white/60">Status</dt>
                <dd>
                  <Pill tone={license.access.mode === "full" ? "good" : "warn"}>{license.license.status.replace("_", " ").toLowerCase()}</Pill>
                </dd>
              </div>
              {license.license.trialEndsAt && (
                <div className="flex justify-between">
                  <dt className="text-black/60 dark:text-white/60">Pilot ends</dt>
                  <dd>{formatDate(license.license.trialEndsAt)}</dd>
                </div>
              )}
              {license.license.currentPeriodEnd && (
                <div className="flex justify-between">
                  <dt className="text-black/60 dark:text-white/60">Renews / ends</dt>
                  <dd>{formatDate(license.license.currentPeriodEnd)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-black/60 dark:text-white/60">This workspace has no licence yet.</p>
              <ButtonLink href={`${base}/settings/licence`}>See plans</ButtonLink>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
