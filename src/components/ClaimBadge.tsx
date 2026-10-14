import type { ClaimType } from "@/generated/prisma";
import { Badge, type Tone } from "@/components/ui";

const tone: Record<ClaimType, Tone> = { FACT: "success", OBSERVATION: "info", INFERENCE: "neutral", HYPOTHESIS: "warning", RECOMMENDATION: "accent" };
const label: Record<ClaimType, string> = { FACT: "Fact", OBSERVATION: "Observation", INFERENCE: "Inference", HYPOTHESIS: "Hypothesis", RECOMMENDATION: "Recommendation" };
export const CLAIM_LABELS = label;
export function ClaimBadge({ c }: { c: ClaimType }) {
  return <Badge tone={tone[c]}>{label[c]}</Badge>;
}
