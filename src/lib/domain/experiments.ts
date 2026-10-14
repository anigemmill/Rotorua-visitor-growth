// Experiment evaluation. Deliberately conservative: it reports whether the
// observed change met the pre-registered thresholds and always lists the
// attribution caveats. It never claims incremental economic impact.

import type { ComparisonMethod } from "@/generated/prisma";

export interface ExperimentInput {
  comparisonMethod: ComparisonMethod;
  baselineValue: number | null;
  targetValue: number | null;
  minimumAcceptable: number | null;
  actualValue: number | null;
  controlValue: number | null;
  higherIsBetter: boolean;
  maxCostNzd: number | null;
  actualCostNzd: number | null;
  hasIllustrativeData?: boolean;
}

export type Verdict = "insufficient_data" | "target_met" | "minimum_met" | "below_minimum" | "over_budget";

export interface Evaluation {
  verdict: Verdict;
  change: number | null;
  changePct: number | null;
  /** change in treated group minus change implied by control (difference-in-differences-lite) */
  netOfControl: number | null;
  caveats: string[];
}

export function evaluateExperiment(e: ExperimentInput): Evaluation {
  const caveats: string[] = [];
  if (e.hasIllustrativeData) caveats.push("Includes illustrative (synthetic) values — not evidence of a real result.");

  switch (e.comparisonMethod) {
    case "NONE":
      caveats.push("No comparison group or baseline method: results are descriptive only and cannot show cause.");
      break;
    case "BEFORE_AFTER":
      caveats.push("Before/after comparison does not control for seasonality, events, pricing or other concurrent changes.");
      break;
    case "MATCHED_COMPARISON":
      caveats.push("Matched comparison depends on how similar the comparison businesses/periods really are.");
      break;
    case "CONTROL_GROUP":
      caveats.push("Check the control group was allocated fairly and is large enough to be meaningful.");
      break;
  }

  if (e.actualValue == null || e.baselineValue == null) {
    return { verdict: "insufficient_data", change: null, changePct: null, netOfControl: null, caveats: ["Baseline and result values are both required before evaluating.", ...caveats] };
  }

  const change = e.actualValue - e.baselineValue;
  const changePct = e.baselineValue !== 0 ? change / Math.abs(e.baselineValue) : null;
  const netOfControl =
    e.controlValue != null && (e.comparisonMethod === "CONTROL_GROUP" || e.comparisonMethod === "MATCHED_COMPARISON")
      ? e.actualValue - e.controlValue
      : null;

  const better = (a: number, b: number) => (e.higherIsBetter ? a >= b : a <= b);

  let verdict: Verdict;
  if (e.maxCostNzd != null && e.actualCostNzd != null && e.actualCostNzd > e.maxCostNzd) verdict = "over_budget";
  else if (e.targetValue != null && better(e.actualValue, e.targetValue)) verdict = "target_met";
  else if (e.minimumAcceptable != null && better(e.actualValue, e.minimumAcceptable)) verdict = "minimum_met";
  else if (e.minimumAcceptable == null && e.targetValue == null) {
    caveats.unshift("No target or minimum acceptable result was set in advance.");
    verdict = "insufficient_data";
  } else verdict = "below_minimum";

  if (e.comparisonMethod === "CONTROL_GROUP" && e.controlValue == null) {
    caveats.push("Control group selected but no control result recorded.");
  }

  return { verdict, change, changePct, netOfControl, caveats };
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  insufficient_data: "Not enough data to judge",
  target_met: "Target met",
  minimum_met: "Minimum met, target not met",
  below_minimum: "Below minimum acceptable result",
  over_budget: "Exceeded maximum acceptable cost",
};
