import type { Operator } from "@/generated/prisma";
import { ActionForm, FormGrid, FormSection, Select, TextArea, TextField } from "@/components/ui";
import type { ActionState } from "@/lib/forms";
import { OPERATOR_CATEGORIES, OPERATOR_STATUS_LABELS, options } from "@/lib/labels";

export function OperatorForm({
  action,
  op,
  submitLabel,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  op?: Operator;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      <FormSection title="Business">
        <FormGrid>
          <TextField name="name" label="Business name" required defaultValue={op?.name} />
          <Select name="category" label="Category" required defaultValue={op?.category} options={OPERATOR_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Choose…" />
          <Select name="status" label="Programme status" required defaultValue={op?.status ?? "PROSPECT"} options={options(OPERATOR_STATUS_LABELS)} />
          <TextField name="aiMaturity" label="AI maturity (1–5)" type="number" min={1} max={5} step="1" defaultValue={op?.aiMaturity} hint="1 = no AI use · 3 = ad-hoc tools · 5 = embedded in operations" />
          <TextField name="websiteUrl" label="Website" type="url" defaultValue={op?.websiteUrl} placeholder="https://" />
          <TextField name="bookingUrl" label="Booking link" type="url" defaultValue={op?.bookingUrl} placeholder="https://" />
        </FormGrid>
        <div className="mt-4">
          <TextArea name="experiences" label="Experiences offered" defaultValue={op?.experiences} />
        </div>
      </FormSection>
      <FormSection title="Contact">
        <FormGrid cols={3}>
          <TextField name="contactName" label="Contact name" defaultValue={op?.contactName} />
          <TextField name="contactEmail" label="Email" type="email" defaultValue={op?.contactEmail} />
          <TextField name="contactPhone" label="Phone" type="tel" defaultValue={op?.contactPhone} />
        </FormGrid>
      </FormSection>
      <FormSection title="Market & operations" description="Comma-separated lists.">
        <FormGrid>
          <TextField name="targetMarkets" label="Target markets & audiences" defaultValue={op?.targetMarkets.join(", ")} />
          <TextField name="marketingChannels" label="Marketing channels" defaultValue={op?.marketingChannels.join(", ")} />
          <TextField name="techStack" label="Technology & AI tools" defaultValue={op?.techStack.join(", ")} />
          <TextField name="groupTags" label="Grouping tags" defaultValue={op?.groupTags.join(", ")} hint="e.g. overnight-package, needs-booking-help" />
        </FormGrid>
        <div className="mt-4 grid gap-4">
          <TextArea name="bookingProcess" label="Booking & enquiry process" defaultValue={op?.bookingProcess} />
          <TextArea name="objectives" label="Business objectives" defaultValue={op?.objectives} />
          <TextArea name="challenges" label="Challenges" defaultValue={op?.challenges} />
          <TextArea name="seasonality" label="Capacity & seasonal considerations" defaultValue={op?.seasonality} />
          <TextArea name="internalNotes" label="Internal notes (staff only)" defaultValue={op?.internalNotes} />
        </div>
      </FormSection>
    </ActionForm>
  );
}
