import { ActionForm, Card, EvidenceBadge, FormGrid, Select, TextArea, TextField } from "@/components/ui";
import { addEvidence } from "@/app/actions/evidence";
import { prisma } from "@/lib/prisma";
import { EVIDENCE_LABELS, VISIBILITY_LABELS, options } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export async function EvidencePanel({
  entityType,
  entityId,
  operatorId,
  path,
}: {
  entityType: string;
  entityId: string;
  operatorId: string | null;
  path: string;
}) {
  const rows = await prisma.evidence.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" } });
  return (
    <Card title="Evidence" description="Every claim should be traceable. Mark what kind of evidence it is.">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No evidence recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2"><EvidenceBadge k={r.kind} /><span className="text-xs text-subtle">{r.recordedBy} · {formatDate(r.observedAt ?? r.createdAt)}</span></div>
              <p className="mt-1 whitespace-pre-wrap">{r.description}</p>
              {r.reference && <p className="mt-0.5 break-all text-xs text-muted">Source: {r.reference}</p>}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-accent">Add evidence</summary>
        <div className="mt-3">
          <ActionForm action={addEvidence.bind(null, { entityType, entityId, operatorId, path })} submitLabel="Add evidence" resetOnSuccess>
            <FormGrid>
              <Select name="kind" label="Kind" options={options(EVIDENCE_LABELS)} defaultValue="OBSERVED" />
              <TextField name="observedAt" label="Date observed" type="date" />
            </FormGrid>
            <TextArea name="description" label="What does it show?" required rows={2} />
            <FormGrid>
              <TextField name="reference" label="Source / location" placeholder="Link to file in Drive, export name…" />
              <Select name="visibility" label="Visible to" options={options(VISIBILITY_LABELS)} defaultValue="CONFIDENTIAL" />
            </FormGrid>
          </ActionForm>
        </div>
      </details>
    </Card>
  );
}
