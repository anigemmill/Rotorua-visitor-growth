import { test } from "node:test";
import assert from "node:assert/strict";
import { programmeWeek, stageForWeek, validateStages, weekStart, DEFAULT_STAGES } from "./programme";
import { priorityScore, roadmapOrder, suggestHorizon } from "./prioritise";
import { evaluateExperiment } from "./experiments";
import { dealValue, runScenario, summarise } from "./commercial";
import { compareMeasurements } from "./results";
import { buildBrief } from "./brief";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test("programme week maths follows the start date", () => {
  const start = d("2026-10-05");
  assert.equal(programmeWeek(start, d("2026-10-04"), 12), 0);
  assert.equal(programmeWeek(start, d("2026-10-05"), 12), 1);
  assert.equal(programmeWeek(start, d("2026-10-11"), 12), 1);
  assert.equal(programmeWeek(start, d("2026-10-12"), 12), 2);
  assert.equal(programmeWeek(start, d("2027-06-01"), 12), 13);
  assert.equal(weekStart(start, 3).toISOString().slice(0, 10), "2026-10-19");
  // moving the start date moves every derived date
  assert.equal(weekStart(d("2026-11-02"), 3).toISOString().slice(0, 10), "2026-11-16");
  assert.equal(stageForWeek(DEFAULT_STAGES, 4)?.name, "Build & implement");
});

test("stage validation rejects overlaps and out-of-range weeks", () => {
  assert.equal(validateStages(DEFAULT_STAGES, 12), null);
  assert.match(validateStages([{ name: "A", startWeek: 1, endWeek: 3 }, { name: "B", startWeek: 3, endWeek: 5 }], 12)!, /overlaps/);
  assert.match(validateStages(DEFAULT_STAGES, 10)!, /outside/);
  assert.match(validateStages([{ name: "A", startWeek: 4, endWeek: 2 }], 12)!, /ends before/);
});

test("priority score rewards impact, penalises effort, discounts low confidence", () => {
  assert.equal(priorityScore({ impactScore: 5, effortScore: 1, confidence: "HIGH" }), 100);
  assert.ok(priorityScore({ impactScore: 5, effortScore: 1, confidence: "LOW" }) < 100);
  assert.ok(priorityScore({ impactScore: 2, effortScore: 5, confidence: "HIGH" }) < priorityScore({ impactScore: 2, effortScore: 1, confidence: "HIGH" }));
  assert.equal(suggestHorizon(80), "NOW");
  assert.equal(suggestHorizon(5), "IGNORE");
  const ordered = roadmapOrder([
    { impactScore: 5, effortScore: 1, confidence: "HIGH" as const, horizon: "NEXT" as const, id: "a" },
    { impactScore: 2, effortScore: 4, confidence: "LOW" as const, horizon: "NOW" as const, id: "b" },
    { impactScore: 4, effortScore: 1, confidence: "HIGH" as const, horizon: "NOW" as const, id: "c" },
  ]);
  assert.deepEqual(ordered.map((o) => o.id), ["c", "b", "a"]);
});

const base = { comparisonMethod: "BEFORE_AFTER" as const, baselineValue: 18, targetValue: 24, minimumAcceptable: 21, actualValue: null as number | null, controlValue: null, higherIsBetter: true, maxCostNzd: 1000, actualCostNzd: null as number | null };

test("experiment evaluation is threshold-based and always caveated", () => {
  assert.equal(evaluateExperiment(base).verdict, "insufficient_data");
  assert.equal(evaluateExperiment({ ...base, actualValue: 25 }).verdict, "target_met");
  assert.equal(evaluateExperiment({ ...base, actualValue: 22 }).verdict, "minimum_met");
  assert.equal(evaluateExperiment({ ...base, actualValue: 19 }).verdict, "below_minimum");
  assert.equal(evaluateExperiment({ ...base, actualValue: 30, actualCostNzd: 1500 }).verdict, "over_budget");
  const ev = evaluateExperiment({ ...base, actualValue: 25, hasIllustrativeData: true });
  assert.ok(ev.caveats.some((c) => /seasonality/.test(c)));
  assert.ok(ev.caveats.some((c) => /synthetic/.test(c)));
  // lower-is-better metrics
  assert.equal(evaluateExperiment({ ...base, higherIsBetter: false, baselineValue: 40, targetValue: 30, minimumAcceptable: 35, actualValue: 28 }).verdict, "target_met");
  // no thresholds => cannot judge
  assert.equal(evaluateExperiment({ ...base, targetValue: null, minimumAcceptable: null, actualValue: 30 }).verdict, "insufficient_data");
  // control group difference
  assert.equal(evaluateExperiment({ ...base, comparisonMethod: "CONTROL_GROUP", actualValue: 25, controlValue: 20 }).netOfControl, 5);
});

test("commercial summary keeps stages separate and never counts forecasts as revenue", () => {
  const deals = [
    { type: "PARTICIPATION_FEE" as const, stage: "CONTRACTED" as const, oneOffValueNzd: 2500, monthlyValueNzd: 0, termMonths: 0, probability: 100, payments: [{ amountNzd: 2500 }] },
    { type: "PARTICIPATION_FEE" as const, stage: "CONTRACTED" as const, oneOffValueNzd: 2500, monthlyValueNzd: 0, termMonths: 0, probability: 100, payments: [] },
    { type: "RECURRING_SERVICE" as const, stage: "PROPOSED" as const, oneOffValueNzd: 0, monthlyValueNzd: 450, termMonths: 12, probability: 50, payments: [] },
    { type: "SPONSORSHIP" as const, stage: "LOST" as const, oneOffValueNzd: 15000, monthlyValueNzd: 0, termMonths: 0, probability: 0, payments: [] },
  ];
  const s = summarise(deals, [{ amountNzd: 1000, isMonthly: false, isForecast: false }, { amountNzd: 100, isMonthly: true, isForecast: true }], 3);
  assert.equal(s.received, 2500);
  assert.equal(s.contracted, 5000);
  assert.equal(s.contractedOutstanding, 2500);
  assert.equal(s.byStage.PROPOSED, 5400);
  assert.equal(s.weightedPipeline, 2700);
  assert.equal(s.actualCosts, 1000);
  assert.equal(s.forecastCosts, 300);
  assert.equal(s.grossMarginOnReceived, 0.6);
  assert.equal(dealValue({ oneOffValueNzd: 100, monthlyValueNzd: 10, termMonths: 6 }), 160);
});

test("pricing scenario economics", () => {
  const r = runScenario({ cohortSize: 10, feePerOperatorNzd: 2500, sponsorshipNzd: 15000, implementationAttachRate: 0.3, implementationAvgNzd: 3500, recurringAttachRate: 0.3, recurringMonthlyNzd: 450, recurringMonths: 12, deliveryHoursPerOperator: 22, sharedDeliveryHours: 60, hourlyCostNzd: 110, softwareMonthlyNzd: 180, programmeMonths: 3, otherFixedCostsNzd: 2500 });
  assert.equal(r.totalRevenue, 25000 + 15000 + 10500 + 16200);
  assert.equal(r.totalHours, 280);
  assert.equal(r.totalCost, 30800 + 540 + 2500);
  assert.equal(r.breakEvenFee, (33840 - 15000) / 10);
  assert.equal(runScenario({ ...{ cohortSize: 0, feePerOperatorNzd: 0, sponsorshipNzd: 0, implementationAttachRate: 0, implementationAvgNzd: 0, recurringAttachRate: 0, recurringMonthlyNzd: 0, recurringMonths: 0, deliveryHoursPerOperator: 0, sharedDeliveryHours: 0, hourlyCostNzd: 0, softwareMonthlyNzd: 0, programmeMonths: 1, otherFixedCostsNzd: 0 } }).grossMargin, null);
});

test("measurement comparison uses latest baseline vs latest result and direction", () => {
  const rows = [
    { metric: "BOOKING_CONVERSION" as const, label: null, kind: "BASELINE" as const, value: 18, unit: "%", periodEnd: d("2026-09-01"), isIllustrative: false },
    { metric: "BOOKING_CONVERSION" as const, label: null, kind: "RESULT" as const, value: 20, unit: "%", periodEnd: d("2026-10-01"), isIllustrative: false },
    { metric: "BOOKING_CONVERSION" as const, label: null, kind: "RESULT" as const, value: 23, unit: "%", periodEnd: d("2026-11-01"), isIllustrative: true },
    { metric: "COST_PER_BOOKING" as const, label: null, kind: "BASELINE" as const, value: 40, unit: "NZD", periodEnd: d("2026-09-01"), isIllustrative: false },
    { metric: "COST_PER_BOOKING" as const, label: null, kind: "RESULT" as const, value: 30, unit: "NZD", periodEnd: d("2026-10-01"), isIllustrative: false },
  ];
  const c = compareMeasurements(rows);
  const conv = c.find((x) => x.metric === "BOOKING_CONVERSION")!;
  assert.equal(conv.result, 23);
  assert.equal(conv.change, 5);
  assert.equal(conv.illustrative, true);
  assert.equal(c.find((x) => x.metric === "COST_PER_BOOKING")!.improved, true);
});

test("weekly brief never invents content and states gaps", () => {
  const empty = buildBrief({ weekOf: d("2026-10-14"), signals: [], opportunities: [], tasks: [], experiments: [], hasBaseline: false });
  assert.equal(empty.whatChanged.length, 0);
  assert.equal(empty.actions.length, 0);
  assert.ok(empty.dataGaps.length >= 3);
  const b = buildBrief({
    weekOf: d("2026-10-14"),
    signals: [
      { id: "s1", title: "new", claimType: "FACT", source: "x", sourceTimestamp: d("2026-10-10"), confidence: "HIGH", isIllustrative: false },
      { id: "s2", title: "old", claimType: "FACT", source: "x", sourceTimestamp: d("2026-08-01"), confidence: "HIGH", isIllustrative: false },
    ],
    opportunities: [
      { id: "o1", title: "Opp", problem: "P", proposedSolution: "S", impactScore: 5, effortScore: 1, confidence: "HIGH", horizon: "NOW", status: "APPROVED", successMetric: null },
      { id: "o2", title: "Later", problem: "P", proposedSolution: "S", impactScore: 5, effortScore: 1, confidence: "HIGH", horizon: "LATER", status: "APPROVED", successMetric: null },
    ],
    tasks: [{ title: "Late", status: "TODO", dueDate: d("2026-10-01"), ownerLabel: "Op", assigneeName: null, requiresApproval: false }],
    experiments: [],
    hasBaseline: true,
  });
  assert.deepEqual(b.whatChanged.map((w) => w.signalId), ["s1"]);
  assert.equal(b.actions[0].action, "Complete: Late");
  assert.equal(b.actions.length, 2);
  assert.ok(b.actions.every((a) => !a.action.includes("Later")));
});
