// Baseline vs result comparison for operator measurements.

import type { MetricKey } from "@/generated/prisma";
import { LOWER_IS_BETTER } from "@/lib/labels";

export interface MeasurementLike {
  metric: MetricKey;
  label: string | null;
  kind: "BASELINE" | "RESULT";
  value: number;
  unit: string;
  periodEnd: Date;
  isIllustrative: boolean;
}

export interface MetricComparison {
  key: string;
  metric: MetricKey;
  label: string | null;
  unit: string;
  baseline: number | null;
  result: number | null;
  change: number | null;
  changePct: number | null;
  improved: boolean | null;
  illustrative: boolean;
}

/** Latest baseline vs latest result per metric (+label for OTHER). */
export function compareMeasurements(rows: MeasurementLike[]): MetricComparison[] {
  const groups = new Map<string, MeasurementLike[]>();
  for (const r of rows) {
    const key = r.metric === "OTHER" ? `OTHER:${r.label ?? ""}` : r.metric;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const out: MetricComparison[] = [];
  for (const [key, list] of groups) {
    const latest = (kind: "BASELINE" | "RESULT") =>
      list.filter((r) => r.kind === kind).sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
    const b = latest("BASELINE");
    const r = latest("RESULT");
    const change = b && r ? r.value - b.value : null;
    const lowerBetter = LOWER_IS_BETTER.includes(list[0].metric);
    out.push({
      key,
      metric: list[0].metric,
      label: list[0].label,
      unit: (r ?? b ?? list[0]).unit,
      baseline: b?.value ?? null,
      result: r?.value ?? null,
      change,
      changePct: change != null && b && b.value !== 0 ? change / Math.abs(b.value) : null,
      improved: change == null || change === 0 ? null : lowerBetter ? change < 0 : change > 0,
      illustrative: list.some((x) => x.isIllustrative),
    });
  }
  return out;
}
