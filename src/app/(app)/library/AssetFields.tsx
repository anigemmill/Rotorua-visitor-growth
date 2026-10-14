import type { WorkflowAsset } from "@/generated/prisma";
import { FormGrid, Select, TextArea, TextField } from "@/components/ui";
import { CULTURAL_LABELS, WORKFLOW_KIND_LABELS, WORKFLOW_STATUS_LABELS, options } from "@/lib/labels";

export function AssetFields({ a }: { a?: WorkflowAsset }) {
  return (
    <>
      <FormGrid>
        <TextField name="name" label="Name" required defaultValue={a?.name} />
        <TextField name="strategicInitiative" label="Strategic initiative" defaultValue={a?.strategicInitiative} placeholder="e.g. Rotorua First Answer" />
        <Select name="kind" label="What it actually is" required options={options(WORKFLOW_KIND_LABELS)} defaultValue={a?.kind ?? "PROMPT_TEMPLATE"} hint="A prompt a person runs ≠ an automated workflow ≠ a functioning agent." />
        <Select name="status" label="Status" options={options(WORKFLOW_STATUS_LABELS)} defaultValue={a?.status ?? "CONCEPT"} hint="Validated/operational require recorded test results." />
        <TextField name="intendedUser" label="Intended user" defaultValue={a?.intendedUser} />
        <TextField name="tools" label="Required tools" defaultValue={a?.tools.join(", ")} />
        <Select name="culturalReview" label="Cultural content" options={options(CULTURAL_LABELS)} defaultValue={a?.culturalReview ?? "NOT_APPLICABLE"} />
      </FormGrid>
      <TextArea name="purpose" label="Purpose" required defaultValue={a?.purpose} rows={2} />
      <TextArea name="problem" label="Problem it solves" defaultValue={a?.problem} rows={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea name="inputs" label="Inputs & data sources" defaultValue={a?.inputs} rows={2} />
        <TextArea name="expectedOutput" label="Expected output" defaultValue={a?.expectedOutput} rows={2} />
        <TextArea name="permissions" label="Permissions needed" defaultValue={a?.permissions} rows={2} />
        <TextArea name="humanApproval" label="Human approval requirements" defaultValue={a?.humanApproval} rows={2} />
        <TextArea name="costNotes" label="Cost considerations" defaultValue={a?.costNotes} rows={2} />
        <TextArea name="limitations" label="Known limitations" defaultValue={a?.limitations} rows={2} />
        <TextArea name="testResults" label="Test results" defaultValue={a?.testResults} rows={2} />
        <TextArea name="evidenceOfValue" label="Evidence of business value" defaultValue={a?.evidenceOfValue} rows={2} />
      </div>
    </>
  );
}
