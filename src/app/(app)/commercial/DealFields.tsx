import type { Deal } from "@/generated/prisma";
import { FormGrid, Select, TextArea, TextField } from "@/components/ui";
import { DEAL_STAGE_LABELS, DEAL_TYPE_LABELS, options } from "@/lib/labels";
import { toDateInput } from "@/lib/format";

export function DealFields({ d, operatorOpts }: { d?: Deal; operatorOpts: { value: string; label: string }[] }) {
  return (
    <>
      <FormGrid cols={3}>
        <TextField name="title" label="Deal" required defaultValue={d?.title} className="sm:col-span-2" />
        <TextField name="organisation" label="Organisation" required defaultValue={d?.organisation} />
        <Select name="type" label="Type" required options={options(DEAL_TYPE_LABELS)} defaultValue={d?.type} placeholder="Choose…" />
        <Select name="stage" label="Stage" options={options(DEAL_STAGE_LABELS)} defaultValue={d?.stage ?? "OPPORTUNITY"} />
        <Select name="operatorId" label="Operator" options={operatorOpts} defaultValue={d?.operatorId} placeholder="—" />
        <TextField name="oneOffValueNzd" label="One-off value (NZD)" type="number" defaultValue={d?.oneOffValueNzd ?? 0} />
        <TextField name="monthlyValueNzd" label="Monthly value (NZD)" type="number" defaultValue={d?.monthlyValueNzd ?? 0} />
        <TextField name="termMonths" label="Term (months)" type="number" step="1" defaultValue={d?.termMonths ?? 0} />
        <TextField name="probability" label="Probability (%)" type="number" step="1" min={0} max={100} defaultValue={d?.probability ?? 25} hint="Weighted forecast only" />
        <TextField name="expectedCloseDate" label="Expected close" type="date" defaultValue={toDateInput(d?.expectedCloseDate)} />
        <TextField name="contractSignedAt" label="Contract signed" type="date" defaultValue={toDateInput(d?.contractSignedAt)} />
        <TextField name="renewalDate" label="Renewal date" type="date" defaultValue={toDateInput(d?.renewalDate)} />
      </FormGrid>
      <TextArea name="notes" label="Notes" defaultValue={d?.notes} rows={2} />
    </>
  );
}
