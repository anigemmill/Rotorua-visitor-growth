import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Badge, Card, EmptyState, FormGrid, Notice, PageHeader, Select, Table, TextArea, TextField, Tabs } from "@/components/ui";
import { BriefView } from "@/components/BriefView";
import { ClaimBadge, CLAIM_LABELS } from "@/components/ClaimBadge";
import { requireStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CONFIDENCE_LABELS, VISIBILITY_LABELS, options } from "@/lib/labels";
import { INTEGRATION_REGISTRY, INTEGRATION_STATUS_LABELS, effectiveStatus } from "@/lib/integrations/registry";
import { formatDate, toDateInput } from "@/lib/format";
import { addSignal, generateBrief, reviewBrief, setIntegration } from "./actions";

const SIGNAL_TYPES = ["DEMAND", "ENQUIRY", "REVIEW", "AI_DISCOVERY", "COMPETITOR", "MARKET", "OPERATIONS"].map((v) => ({ value: v, label: v.replace("_", " ").toLowerCase() }));

export default async function IntelligencePage({ params }: PageProps<"/operators/[id]/intelligence">) {
  await requireStaff();
  const { id } = await params;
  const op = await prisma.operator.findUnique({
    where: { id },
    include: {
      signals: { orderBy: { sourceTimestamp: "desc" }, take: 50 },
      integrations: true,
      briefs: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
  if (!op) notFound();
  const latest = op.briefs[0];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href={`/operators/${op.id}`} className="hover:underline">{op.name}</Link>}
        title="Growth Intelligence"
        description="Operator-level Scan → Brief → Learn. Signals are the evidence; briefs are built only from what is stored here, then reviewed and approved by a person before the operator sees them."
        actions={<ActionForm action={generateBrief.bind(null, op.id)} submitLabel="Generate draft brief" />}
      />
      <Tabs current={`/operators/${op.id}/intelligence`} tabs={[{ href: `/operators/${op.id}`, label: "Workspace" }, { href: `/operators/${op.id}/intelligence`, label: "Growth Intelligence" }]} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Weekly growth brief" description={latest ? `Status: ${latest.status.toLowerCase()}` : undefined}>
            {!latest ? (
              <EmptyState title="No brief yet">Record a few signals, then generate a draft. The draft is rule-based — it ranks and summarises stored data; it does not write new claims.</EmptyState>
            ) : (
              <div className="space-y-5">
                <BriefView brief={latest} />
                <div className="border-t border-line pt-4">
                  <ActionForm action={reviewBrief.bind(null, latest.id)} submitLabel="Save review">
                    <TextArea name="whyItMatters" label="Why it matters (edit before approving)" defaultValue={latest.whyItMatters} rows={2} />
                    <TextArea name="learnings" label="Learnings" defaultValue={latest.learnings} rows={2} />
                    <Select
                      name="status"
                      label="Status"
                      defaultValue={latest.status}
                      options={[
                        { value: "DRAFT", label: "Draft (staff only)" },
                        { value: "APPROVED", label: "Approved (staff only)" },
                        { value: "SHARED", label: "Shared with operator portal" },
                      ]}
                    />
                  </ActionForm>
                </div>
              </div>
            )}
            {op.briefs.length > 1 && (
              <div className="mt-5 border-t border-line pt-3 text-xs text-muted">
                Earlier briefs: {op.briefs.slice(1).map((b) => `${formatDate(b.weekOf)} (${b.status.toLowerCase()})`).join(" · ")}
              </div>
            )}
          </Card>

          <Card title="Signals" description="Atomic evidence. Label each by claim type so facts are never confused with guesses." padded={false}>
            {op.signals.length === 0 ? (
              <div className="p-5"><EmptyState title="No signals recorded" /></div>
            ) : (
              <Table>
                <thead><tr><th>Signal</th><th>Claim</th><th>Source</th><th>Date</th></tr></thead>
                <tbody>
                  {op.signals.map((s) => (
                    <tr key={s.id}>
                      <td className="min-w-[16rem]">
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-muted">{s.summary}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge tone="outline">{s.type.toLowerCase()}</Badge>
                          <Badge>{CONFIDENCE_LABELS[s.confidence]} confidence</Badge>
                          {s.submittedByOperator && <Badge tone="info">From operator</Badge>}
                          {s.isIllustrative && <Badge tone="warning">Illustrative</Badge>}
                        </div>
                      </td>
                      <td><ClaimBadge c={s.claimType} /></td>
                      <td className="text-xs text-muted">{s.source}</td>
                      <td className="whitespace-nowrap text-xs text-muted">{formatDate(s.sourceTimestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <details className="border-t border-line p-5">
              <summary className="cursor-pointer text-sm font-medium text-accent">Record a signal</summary>
              <div className="mt-4">
                <ActionForm action={addSignal.bind(null, op.id)} submitLabel="Record signal" resetOnSuccess>
                  <FormGrid cols={3}>
                    <Select name="type" label="Type" options={SIGNAL_TYPES} defaultValue="ENQUIRY" />
                    <Select name="claimType" label="Claim type" options={Object.entries(CLAIM_LABELS).map(([value, label]) => ({ value, label }))} defaultValue="OBSERVATION" />
                    <Select name="confidence" label="Confidence" options={options(CONFIDENCE_LABELS)} defaultValue="MEDIUM" />
                  </FormGrid>
                  <TextField name="title" label="Headline" required />
                  <TextArea name="summary" label="Summary" required rows={2} />
                  <TextArea name="evidence" label="Evidence" rows={2} />
                  <FormGrid cols={3}>
                    <TextField name="source" label="Source" required placeholder="e.g. Rezdy export, operator call" />
                    <TextField name="sourceTimestamp" label="Date of source" type="date" required defaultValue={toDateInput(new Date())} />
                    <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue="CONFIDENTIAL" />
                    <Select name="momentum" label="Momentum" options={["DECLINING", "STABLE", "RISING"].map((v) => ({ value: v, label: v.toLowerCase() }))} placeholder="—" />
                    <Select name="commercialPotential" label="Commercial potential" options={["LOW", "MEDIUM", "HIGH"].map((v) => ({ value: v, label: v.toLowerCase() }))} placeholder="—" />
                  </FormGrid>
                </ActionForm>
              </div>
            </details>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Data sources" description="Pilot default is manual export. Nothing is marked connected until a tested sync is recorded.">
            <Notice tone="info">No live operator integrations are built in phase 1. This records how each source is obtained.</Notice>
            <ul className="mt-4 space-y-4">
              {INTEGRATION_REGISTRY.map((def) => {
                const row = op.integrations.find((i) => i.sourceKey === def.key);
                const status = effectiveStatus(def, row);
                return (
                  <li key={def.key} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{def.name}</p>
                      <Badge tone={status === "CONNECTED" ? "success" : status === "MANUAL_IMPORT" ? "info" : "outline"}>{INTEGRATION_STATUS_LABELS[status]}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{def.pilotPath}</p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-accent">Update</summary>
                      <div className="mt-2">
                        <ActionForm action={setIntegration.bind(null, op.id, def.key)} submitLabel="Save">
                          <Select name="status" label="Status" options={options(INTEGRATION_STATUS_LABELS)} defaultValue={status} />
                          <TextField name="lastSyncedAt" label="Last tested sync" type="date" defaultValue={toDateInput(row?.lastSyncedAt)} />
                          <TextArea name="notes" label="Notes (no credentials)" defaultValue={row?.notes} rows={2} />
                        </ActionForm>
                        <p className="mt-1 text-xs text-subtle">Live integration would need: {def.requiresForLive}</p>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
