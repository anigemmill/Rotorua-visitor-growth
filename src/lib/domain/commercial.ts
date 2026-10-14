// Commercial planning maths (NZD, excl. GST). Proposed, quoted, contracted
// and received are always reported separately; projected revenue is never
// summed into actual revenue.

import type { DealStage, DealType } from "@/generated/prisma";

export interface DealLike {
  type: DealType;
  stage: DealStage;
  oneOffValueNzd: number;
  monthlyValueNzd: number;
  termMonths: number;
  probability: number;
  payments: { amountNzd: number }[];
}

export interface CostLike {
  amountNzd: number;
  isMonthly: boolean;
  isForecast: boolean;
}

/** Total contract value: one-off + monthly × term. */
export function dealValue(d: Pick<DealLike, "oneOffValueNzd" | "monthlyValueNzd" | "termMonths">): number {
  return d.oneOffValueNzd + d.monthlyValueNzd * d.termMonths;
}

export interface CommercialSummary {
  byStage: Record<Exclude<DealStage, "LOST">, number>;
  weightedPipeline: number; // opportunity/proposed/quoted × probability
  contracted: number;
  received: number;
  contractedOutstanding: number; // contracted − received on contracted deals
  monthlyRecurringContracted: number;
  actualCosts: number;
  forecastCosts: number;
  grossMarginOnReceived: number | null; // (received − actual costs) / received
  grossMarginOnContracted: number | null; // (contracted − actual − forecast) / contracted
}

export function summarise(deals: DealLike[], costs: CostLike[], costMonths = 1): CommercialSummary {
  const byStage = { OPPORTUNITY: 0, PROPOSED: 0, QUOTED: 0, CONTRACTED: 0 };
  let weighted = 0;
  let received = 0;
  let contractedReceived = 0;
  let mrr = 0;
  for (const d of deals) {
    const v = dealValue(d);
    const paid = d.payments.reduce((s, p) => s + p.amountNzd, 0);
    received += paid;
    if (d.stage === "LOST") continue;
    byStage[d.stage] += v;
    if (d.stage === "CONTRACTED") {
      contractedReceived += paid;
      mrr += d.monthlyValueNzd;
    } else {
      weighted += v * (clampPct(d.probability) / 100);
    }
  }
  const costTotal = (c: CostLike) => c.amountNzd * (c.isMonthly ? costMonths : 1);
  const actualCosts = costs.filter((c) => !c.isForecast).reduce((s, c) => s + costTotal(c), 0);
  const forecastCosts = costs.filter((c) => c.isForecast).reduce((s, c) => s + costTotal(c), 0);
  const contracted = byStage.CONTRACTED;

  return {
    byStage,
    weightedPipeline: round(weighted),
    contracted,
    received,
    contractedOutstanding: Math.max(0, contracted - contractedReceived),
    monthlyRecurringContracted: mrr,
    actualCosts,
    forecastCosts,
    grossMarginOnReceived: received > 0 ? (received - actualCosts) / received : null,
    grossMarginOnContracted: contracted > 0 ? (contracted - actualCosts - forecastCosts) / contracted : null,
  };
}

export interface ScenarioInput {
  cohortSize: number;
  feePerOperatorNzd: number;
  sponsorshipNzd: number;
  implementationAttachRate: number;
  implementationAvgNzd: number;
  recurringAttachRate: number;
  recurringMonthlyNzd: number;
  recurringMonths: number;
  deliveryHoursPerOperator: number;
  sharedDeliveryHours: number;
  hourlyCostNzd: number;
  softwareMonthlyNzd: number;
  programmeMonths: number;
  otherFixedCostsNzd: number;
}

export interface ScenarioResult {
  participationRevenue: number;
  implementationRevenue: number;
  recurringRevenue: number;
  sponsorship: number;
  totalRevenue: number;
  deliveryCost: number;
  softwareCost: number;
  fixedCost: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number | null;
  revenuePerOperator: number | null;
  breakEvenFee: number | null; // fee per operator needed for zero programme profit (ex follow-on)
  totalHours: number;
}

/** Economics of one cohort under a pricing model. Pure, illustrative planning only. */
export function runScenario(s: ScenarioInput): ScenarioResult {
  const n = Math.max(0, Math.floor(s.cohortSize));
  const participationRevenue = n * s.feePerOperatorNzd;
  const implementationRevenue = n * clamp01(s.implementationAttachRate) * s.implementationAvgNzd;
  const recurringRevenue = n * clamp01(s.recurringAttachRate) * s.recurringMonthlyNzd * s.recurringMonths;
  const totalRevenue = participationRevenue + implementationRevenue + recurringRevenue + s.sponsorshipNzd;
  const totalHours = n * s.deliveryHoursPerOperator + s.sharedDeliveryHours;
  const deliveryCost = totalHours * s.hourlyCostNzd;
  const softwareCost = s.softwareMonthlyNzd * s.programmeMonths;
  const fixedCost = s.otherFixedCostsNzd;
  const totalCost = deliveryCost + softwareCost + fixedCost;
  const grossProfit = totalRevenue - totalCost;
  const programmeOnlyCost = totalCost;
  return {
    participationRevenue,
    implementationRevenue,
    recurringRevenue,
    sponsorship: s.sponsorshipNzd,
    totalRevenue,
    deliveryCost,
    softwareCost,
    fixedCost,
    totalCost,
    grossProfit,
    grossMargin: totalRevenue > 0 ? grossProfit / totalRevenue : null,
    revenuePerOperator: n > 0 ? totalRevenue / n : null,
    breakEvenFee: n > 0 ? round(Math.max(0, (programmeOnlyCost - s.sponsorshipNzd) / n)) : null,
    totalHours,
  };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function clampPct(v: number) {
  return Math.max(0, Math.min(100, v));
}
function round(v: number) {
  return Math.round(v * 100) / 100;
}
