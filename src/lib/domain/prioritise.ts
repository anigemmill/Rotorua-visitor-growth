// Transparent opportunity prioritisation — a documented rubric, not a
// black-box AI score, so every ranking can be explained to an operator.

import type { ConfidenceLevel, Horizon } from "@/generated/prisma";

export interface Scorable {
  impactScore: number; // 1-5
  effortScore: number; // 1-5 (5 = most effort)
  confidence: ConfidenceLevel;
  horizon: Horizon;
}

const CONF_MULT: Record<ConfidenceLevel, number> = { LOW: 0.6, MEDIUM: 0.8, HIGH: 1 };
const HORIZON_ORDER: Record<Horizon, number> = { NOW: 0, NEXT: 1, LATER: 2, IGNORE: 3 };

/**
 * Priority score 0–100: value relative to effort, discounted by confidence.
 * impact 5 / effort 1 / high confidence = 100; impact 1 / effort 5 / low ≈ 4.
 */
export function priorityScore(o: Pick<Scorable, "impactScore" | "effortScore" | "confidence">): number {
  const impact = clamp(o.impactScore, 1, 5);
  const effort = clamp(o.effortScore, 1, 5);
  const ratio = (impact / 5) * ((6 - effort) / 5); // 0.04 – 1
  return Math.round(ratio * CONF_MULT[o.confidence] * 100);
}

export function priorityBand(score: number): "High" | "Medium" | "Low" {
  return score >= 60 ? "High" : score >= 30 ? "Medium" : "Low";
}

/** Roadmap order: horizon first (NOW → IGNORE), then score descending. */
export function roadmapOrder<T extends Scorable>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon] || priorityScore(b) - priorityScore(a)
  );
}

/** Suggested horizon from the score — staff can always override. */
export function suggestHorizon(score: number): Horizon {
  return score >= 60 ? "NOW" : score >= 30 ? "NEXT" : score >= 12 ? "LATER" : "IGNORE";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
