import { PageHeader, Panel, Pill } from "@/components/platform/ui";
import { AGENTS, EVIDENCE_LABELS, WORKFLOW_STAGES } from "@/lib/agents/registry";
import { requireOrg } from "@/lib/web/session";

export default async function EcosystemPage({ params }: PageProps<"/app/[org]/ecosystem">) {
  const { org } = await params;
  await requireOrg(org);

  return (
    <>
      <PageHeader
        title="Your agent ecosystem"
        description="A coordinated team of specialist agents. They don't talk to each other freely — the orchestrator routes work through a fixed, auditable workflow, and every output is checked before you see it."
      />
      <Panel title="How every intelligence cycle runs" className="mb-6">
        <ol className="flex flex-wrap gap-2 text-xs">
          {WORKFLOW_STAGES.map((s, i) => (
            <li key={s} className="rounded-full border border-black/15 px-3 py-1 dark:border-white/15">
              {i + 1}. {s.charAt(0) + s.slice(1).toLowerCase()}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-black/60 dark:text-white/60">
          Every statement in a report is labelled {EVIDENCE_LABELS.join(", ")} and carries its source, retrieval date, reporting
          period and known limitations. Estimated impact is always shown as an estimate.
        </p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {AGENTS.map((a) => (
          <Panel key={a.key}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{a.name}</p>
              <Pill>Phase {a.plannedPhase}</Pill>
            </div>
            <p className="mt-1 text-sm text-black/65 dark:text-white/65">{a.purpose}</p>
            <p className="mt-3 text-xs font-medium uppercase text-black/45 dark:text-white/45">Runs</p>
            <p className="text-sm">{a.triggers.join("; ")}</p>
            <p className="mt-2 text-xs font-medium uppercase text-black/45 dark:text-white/45">Delivers</p>
            <p className="text-sm">{a.outputs.join("; ")}</p>
          </Panel>
        ))}
      </div>
    </>
  );
}
