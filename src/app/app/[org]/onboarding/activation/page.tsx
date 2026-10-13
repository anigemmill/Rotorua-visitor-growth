import { Notice, PageHeader, Panel, Pill } from "@/components/platform/ui";
import { AGENTS } from "@/lib/agents/registry";
import { getProvider } from "@/lib/integrations/registry";
import { requireOrg } from "@/lib/web/session";

export default async function ActivationPage({ params }: PageProps<"/app/[org]/onboarding/activation">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const connections = await ctx.db.integrationConnection.findMany({
    where: { status: { not: "REVOKED" } },
    select: { providerKey: true },
  });
  const have = new Set(connections.map((c) => c.providerKey));

  return (
    <>
      <PageHeader
        title="Activate your ecosystem"
        description="Review exactly which agents will run, what data they use, what they produce and which actions will wait for your approval. Scheduled workflows are only enabled after you explicitly confirm."
      />
      <div className="mb-6">
        <Notice tone="warn">
          Activation opens when the first agent workflows are released (Phase 3). Nothing is scheduled or run in this
          workspace yet, and no data is sent to an AI model.
        </Notice>
      </div>
      <div className="space-y-3">
        {AGENTS.map((a) => {
          const missing = a.integrations.requiredAny.length > 0 && !a.integrations.requiredAny.some((k) => have.has(k));
          return (
            <Panel key={a.key}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-2xl">
                  <p className="font-medium">{a.name}</p>
                  <p className="mt-0.5 text-sm text-black/60 dark:text-white/60">{a.purpose}</p>
                </div>
                <div className="flex gap-2">
                  <Pill>Phase {a.plannedPhase}</Pill>
                  {missing ? <Pill tone="warn">Needs data</Pill> : <Pill tone="good">Data requirements met</Pill>}
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Uses</p>
                  <p>{a.dataAccess.join("; ")}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Produces</p>
                  <p>{a.outputs.join("; ")}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-black/45 dark:text-white/45">Needs your approval for</p>
                  <p>{a.approvalRequiredFor.length ? a.approvalRequiredFor.join("; ") : "Nothing — it only reports"}</p>
                </div>
              </div>
              {missing && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-400">
                  Connect one of: {a.integrations.requiredAny.map((k) => getProvider(k)?.name ?? k).join(", ")}.
                </p>
              )}
            </Panel>
          );
        })}
      </div>
      <div className="mt-6">
        <button disabled className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white opacity-50">
          Activate scheduled workflows (available from Phase 3)
        </button>
      </div>
    </>
  );
}
