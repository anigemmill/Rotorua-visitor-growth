// Shared governance types/helpers used across engines, importers and
// connectors. See docs/ARCHITECTURE.md §1-2.

import type { AccessLevel, Confidence } from "@/generated/prisma";

export interface GovernanceMetadata {
  geography: string;
  periodStart: Date;
  periodEnd: Date;
  confidence: Confidence;
  accessLevel: AccessLevel;
}

export const CONFIDENCE_ORDER: Confidence[] = [
  "VERIFIED",
  "HIGH",
  "MEDIUM",
  "LOW",
  "MODELLED",
];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  PUBLIC: "Public data",
  PARTNER: "Partner data",
  PRIVATE_BUSINESS: "Private business data",
  AGGREGATED: "Aggregated data",
  MODEL_INFERENCE: "Model inference",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  VERIFIED: "Verified",
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
  MODELLED: "Modelled / inferred",
};

/**
 * An engine must never present derived intelligence as more certain than
 * its worst input. Given the confidence levels of the observation rows an
 * insight was built from, returns the confidence the insight itself may
 * claim (never higher than the least-confident input, and never VERIFIED
 * for anything derived).
 */
export function deriveConfidence(inputConfidences: Confidence[]): Confidence {
  if (inputConfidences.length === 0) return "MODELLED";
  const worstIndex = Math.max(
    ...inputConfidences.map((c) => CONFIDENCE_ORDER.indexOf(c))
  );
  const worst = CONFIDENCE_ORDER[worstIndex];
  // A derived insight is never more certain than VERIFIED-but-still-derived;
  // cap at HIGH unless every input is itself already MODELLED (then stay MODELLED).
  return worst === "VERIFIED" ? "HIGH" : worst;
}
