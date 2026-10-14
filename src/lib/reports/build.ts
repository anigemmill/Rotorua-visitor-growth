// Report builders. Every statement is derived from stored records; where
// data is missing the report says so. Illustrative (synthetic) values are
// labelled on every finding that uses them.

import { prisma } from "@/lib/prisma";
import { compareMeasurements } from "@/lib/domain/results";
import { evaluateExperiment, VERDICT_LABELS } from "@/lib/domain/experiments";
import { programmeWeek, stageForWeek } from "@/lib/domain/programme";
import { priorityScore, roadmapOrder } from "@/lib/domain/prioritise";
import { dealValue, summarise } from "@/lib/domain/commercial";
import { AREA_LABELS, COMPARISON_LABELS, DEAL_STAGE_LABELS, DEAL_TYPE_LABELS, DECISION_LABELS, HORIZON_LABELS, METRIC_LABELS, OPP_STATUS_LABELS, SOLUTION_LABELS, WORK_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatNum, formatNzd, pct } from "@/lib/format";
import type { Finding, Report } from "./types";

const DAY = 86_400_000;
const inTwoWeeks = () => formatDate(new Date(Date.now() + 14 * DAY));
const SYNTH = "Contains synthetic demonstration data. Illustrative values are not real results and must not be quoted as evidence.";

export async function operatorReport(operatorId: string): Promise<Report | null> {
  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    include: {
      opportunities: true,
      measurements: true,
      experiments: true,
      projects: true,
      tasks: { where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } },
      decisions: { where: { decided: false } },
      assessments: { orderBy: { createdAt: "desc" }, take: 1, include: { areas: true } },
    },
  });
  if (!op) return null;
  const notices: string[] = [];
  if (op.isSynthetic) notices.push(SYNTH);

  const findings: Finding[] = [];
  for (const c of compareMeasurements(op.measurements)) {
    if (c.result == null) continue;
    findings.push({
      title: c.label ?? METRIC_LABELS[c.metric],
      whatChanged: c.change == null ? "No baseline to compare." : `${formatNum(c.baseline)} → ${formatNum(c.result)} ${c.unit} (${c.change > 0 ? "+" : ""}${formatNum(c.change)}${c.changePct != null ? `, ${pct(c.changePct)}` : ""}).`,
      evidence: "Recorded measurements (see Baselines & results for source and evidence type).",
      whyItMatters: c.improved ? "Moving in the intended direction — but a before/after change alone does not prove the intervention caused it." : c.improved === false ? "Moving against the intended direction; investigate before scaling anything related." : "No change.",
      next: "Confirm with the operator whether other factors (season, pricing, events) changed in the same period.",
      owner: "Programme lead + operator",
      reviewDate: inTwoWeeks(),
      illustrative: c.illustrative,
    });
  }
  for (const e of op.experiments.filter((x) => ["ANALYSING", "COMPLETE"].includes(x.status))) {
    const ev = evaluateExperiment({ ...e, hasIllustrativeData: e.isIllustrative });
    findings.push({
      title: `Experiment: ${e.title}`,
      whatChanged: `${VERDICT_LABELS[ev.verdict]}. ${e.resultSummary ?? ""}`.trim(),
      evidence: `${COMPARISON_LABELS[e.comparisonMethod]}; baseline ${formatNum(e.baselineValue)}, result ${formatNum(e.actualValue)}, target ${formatNum(e.targetValue)}, minimum ${formatNum(e.minimumAcceptable)}. Caveats: ${ev.caveats.join(" ")}`,
      whyItMatters: e.hypothesis,
      next: e.nextAction ?? (e.decision ? `Decision recorded: ${DECISION_LABELS[e.decision]}.` : "Record a scale / amend / stop decision."),
      owner: "Programme lead",
      reviewDate: inTwoWeeks(),
      illustrative: e.isIllustrative,
    });
  }
  for (const d of op.decisions) {
    findings.push({
      title: `Decision needed: ${d.title}`,
      whatChanged: d.whatChanged, evidence: d.evidence ?? "—", whyItMatters: d.whyItMatters ?? "—",
      next: d.nextAction ?? "—", owner: d.owner ?? "—", reviewDate: formatDate(d.reviewDate),
    });
  }

  const roadmap = roadmapOrder(op.opportunities.filter((o) => o.visibility !== "INTERNAL"));
  const a = op.assessments[0];
  return {
    title: `${op.name} — AI Growth Report`,
    subtitle: "Tourism AI Growth Pilot · individual operator report",
    generatedAt: new Date(),
    audience: "The operator and programme staff (confidential)",
    notices,
    sections: [
      {
        heading: "Summary",
        paragraphs: [
          `${op.opportunities.length} opportunities identified (${op.opportunities.filter((o) => o.horizon === "NOW").length} prioritised for now), ${op.projects.length} implementation projects, ${op.experiments.length} experiments, ${op.tasks.length} open actions.`,
          a?.summary ?? "Assessment summary not yet written.",
        ],
      },
      ...(a ? [{ heading: "Assessment — current capability (1–5)", table: { head: ["Area", "Score"], rows: a.areas.map((x) => [AREA_LABELS[x.area], x.score ?? "—"]) } }] : []),
      { heading: "Findings", findings, paragraphs: findings.length ? undefined : ["No results recorded yet. Findings appear once results are measured against a baseline."] },
      {
        heading: "Roadmap",
        table: { head: ["Opportunity", "Approach", "Horizon", "Status", "Score"], rows: roadmap.map((o) => [o.title, SOLUTION_LABELS[o.solutionType], HORIZON_LABELS[o.horizon], OPP_STATUS_LABELS[o.status], priorityScore(o)]) },
      },
      { heading: "Open actions", table: { head: ["Action", "Due", "Status"], rows: op.tasks.map((t) => [t.title, formatDate(t.dueDate), WORK_STATUS_LABELS[t.status]]) } },
    ],
  };
}

export async function cohortReport(): Promise<Report> {
  const [ops, learnings, experiments, workshops] = await Promise.all([
    prisma.operator.findMany({ where: { status: { notIn: ["WITHDRAWN", "PROSPECT"] } }, include: { measurements: true, opportunities: { select: { solutionType: true, status: true, area: true } }, attendance: true } }),
    prisma.learning.findMany({ where: { visibility: { in: ["COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"] }, culturalReview: { not: "REQUIRED" } }, orderBy: { createdAt: "desc" } }),
    prisma.experiment.findMany({ where: { status: { in: ["ANALYSING", "COMPLETE"] } } }),
    prisma.workshop.count({ where: { status: "DONE" } }),
  ]);
  const consenting = ops.filter((o) => o.consentAggregate);
  const notices = [`Aggregate figures include only the ${consenting.length} of ${ops.length} operators who consented to anonymised aggregate reporting. No individual business is named.`];
  if (ops.some((o) => o.isSynthetic)) notices.push(SYNTH);

  const byArea = new Map<string, number>();
  const bySolution = new Map<string, number>();
  for (const o of consenting) for (const opp of o.opportunities) {
    byArea.set(AREA_LABELS[opp.area], (byArea.get(AREA_LABELS[opp.area]) ?? 0) + 1);
    bySolution.set(SOLUTION_LABELS[opp.solutionType], (bySolution.get(SOLUTION_LABELS[opp.solutionType]) ?? 0) + 1);
  }
  const improved = consenting.map((o) => compareMeasurements(o.measurements).filter((c) => c.improved)).flat();
  const anyIllustrative = consenting.some((o) => o.measurements.some((m) => m.isIllustrative));
  const attendanceRate = workshops && ops.length ? ops.reduce((s, o) => s + o.attendance.filter((a) => a.attended).length, 0) / (workshops * ops.length) : null;
  const evals = experiments.map((e) => evaluateExperiment({ ...e, hasIllustrativeData: e.isIllustrative }));

  return {
    title: "Tourism AI Growth Collective — Cohort Learning Summary",
    subtitle: "Anonymised, aggregate view for the cohort and partners",
    generatedAt: new Date(),
    audience: "Cohort operators and programme partners",
    notices,
    sections: [
      { heading: "Participation", bullets: [`${ops.length} participating operators`, `${workshops} workshops held`, `Average attendance: ${attendanceRate == null ? "—" : pct(attendanceRate)}`] },
      { heading: "Where the opportunities are", table: { head: ["Area", "Opportunities"], rows: [...byArea.entries()].sort((a, b) => b[1] - a[1]) } },
      { heading: "What kind of solutions", paragraphs: ["Not every opportunity needs AI. The split below shows how often a process change, better website information or simple automation was the better answer."], table: { head: ["Solution type", "Count"], rows: [...bySolution.entries()].sort((a, b) => b[1] - a[1]) } },
      { heading: "Results so far", paragraphs: [`${improved.length} metric improvements recorded across consenting operators${anyIllustrative ? " (includes illustrative values)" : ""}. ${evals.length} experiments in analysis or complete: ${evals.filter((e) => e.verdict === "target_met").length} met target, ${evals.filter((e) => e.verdict === "minimum_met").length} met minimum only, ${evals.filter((e) => ["below_minimum", "over_budget"].includes(e.verdict)).length} fell short.`, "Improvements are before/after observations unless stated; they are not proof of incremental economic impact."] },
      { heading: "Shared learnings", bullets: learnings.map((l) => `**${l.title}** — ${l.body}${l.isReusableProcess ? " _(reusable process)_" : ""}`) },
    ],
  };
}

export async function founderReport(includeCommercial: boolean): Promise<Report> {
  const [programme, ops, risks, decisions, experiments, tasksOverdue, deals, costs] = await Promise.all([
    prisma.programme.findFirst({ where: { active: true }, include: { stages: true, milestones: true } }),
    prisma.operator.findMany({ where: { status: { notIn: ["WITHDRAWN"] } }, orderBy: { name: "asc" }, include: { assessments: { take: 1, orderBy: { createdAt: "desc" } }, opportunities: true, measurements: { where: { kind: "BASELINE" } }, projects: true } }),
    prisma.risk.findMany({ where: { status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.decisionRecord.findMany({ where: { decided: false } }),
    prisma.experiment.findMany(),
    prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, dueDate: { lt: new Date() } } }),
    includeCommercial ? prisma.deal.findMany({ include: { payments: true } }) : Promise.resolve([]),
    includeCommercial ? prisma.costItem.findMany() : Promise.resolve([]),
  ]);
  const week = programme ? programmeWeek(programme.startDate, new Date(), programme.totalWeeks) : 0;
  const stage = programme ? stageForWeek(programme.stages, week) : null;
  const notices = ops.some((o) => o.isSynthetic) ? [SYNTH] : [];
  const c = includeCommercial ? summarise(deals, costs, 3) : null;
  return {
    title: "Founder Programme Report",
    subtitle: programme ? `${programme.name} · week ${week} of ${programme.totalWeeks}${stage ? ` · ${stage.name}` : ""}` : "No active programme",
    generatedAt: new Date(),
    audience: "Founder (internal)",
    notices,
    sections: [
      { heading: "Programme status", bullets: [`Milestones complete: ${programme?.milestones.filter((m) => m.status === "DONE").length ?? 0}/${programme?.milestones.length ?? 0}`, `Overdue milestones: ${programme?.milestones.filter((m) => m.status !== "DONE" && m.week < week).map((m) => m.title).join("; ") || "none"}`, `Overdue tasks: ${tasksOverdue}`, `Experiments: ${experiments.filter((e) => e.status === "RUNNING").length} running, ${experiments.filter((e) => ["ANALYSING", "COMPLETE"].includes(e.status)).length} with results`] },
      { heading: "Operators", table: { head: ["Operator", "Status", "Assessment", "Baseline", "Opportunities (NOW)", "Projects"], rows: ops.map((o) => [o.name, o.status.toLowerCase(), o.assessments[0]?.status.toLowerCase().replace("_", " ") ?? "none", o.measurements.length ? "yes" : "MISSING", `${o.opportunities.length} (${o.opportunities.filter((x) => x.horizon === "NOW").length})`, o.projects.length]) } },
      { heading: "Risks & blockers", table: { head: ["Kind", "Severity", "Title", "Owner", "Mitigation"], rows: risks.map((r) => [r.kind.toLowerCase(), r.severity.toLowerCase(), r.title, r.owner ?? "—", r.mitigation ?? "—"]) } },
      { heading: "Decisions requiring attention", findings: decisions.map((d) => ({ title: d.title, whatChanged: d.whatChanged, evidence: d.evidence ?? "—", whyItMatters: d.whyItMatters ?? "—", next: d.nextAction ?? "—", owner: d.owner ?? "—", reviewDate: formatDate(d.reviewDate) })) },
      ...(c ? [{ heading: "Commercial (NZD excl. GST)", paragraphs: deals.some((d) => d.isIllustrative) ? ["Includes illustrative demo figures."] : undefined, bullets: [`Received: ${formatNzd(c.received)}`, `Contracted: ${formatNzd(c.contracted)} (outstanding ${formatNzd(c.contractedOutstanding)})`, `Quoted: ${formatNzd(c.byStage.QUOTED)} · Proposed: ${formatNzd(c.byStage.PROPOSED)} · Weighted pipeline (forecast): ${formatNzd(c.weightedPipeline)}`, `Costs to date: ${formatNzd(c.actualCosts)} · Forecast costs: ${formatNzd(c.forecastCosts)}`, `Gross margin on received: ${c.grossMarginOnReceived == null ? "—" : pct(c.grossMarginOnReceived)}`] }] : []),
    ],
  };
}

export async function experimentReport(id: string): Promise<Report | null> {
  const e = await prisma.experiment.findUnique({ where: { id }, include: { operator: true, initiative: true } });
  if (!e) return null;
  const ev = evaluateExperiment({ ...e, hasIllustrativeData: e.isIllustrative });
  const evidence = await prisma.evidence.findMany({ where: { entityType: "experiment", entityId: id } });
  return {
    title: `Experiment Report — ${e.title}`,
    subtitle: e.operator?.name ?? e.initiative?.title ?? (e.isDestinationLevel ? "Destination-level" : ""),
    generatedAt: new Date(),
    audience: "Programme staff and participating operator(s)",
    notices: e.isIllustrative ? [SYNTH] : [],
    sections: [
      { heading: "Design", bullets: [`Hypothesis: ${e.hypothesis}`, `Problem: ${e.problem}`, `Audience: ${e.audience ?? "—"}`, `Intervention: ${e.intervention}`, `Dates: ${formatDate(e.startDate)} – ${formatDate(e.endDate)}; baseline ${formatDate(e.baselineStart)} – ${formatDate(e.baselineEnd)}`, `Comparison: ${COMPARISON_LABELS[e.comparisonMethod]}`, `Primary metric: ${e.primaryMetricLabel ?? METRIC_LABELS[e.primaryMetric]}; secondary: ${e.secondaryMetrics.join(", ") || "—"}`, `Minimum acceptable: ${formatNum(e.minimumAcceptable)} · Target: ${formatNum(e.targetValue)} · Max cost: ${formatNzd(e.maxCostNzd)}`] },
      { heading: "Result", findings: [{ title: VERDICT_LABELS[ev.verdict], whatChanged: `Baseline ${formatNum(e.baselineValue)} → actual ${formatNum(e.actualValue)}${ev.changePct != null ? ` (${pct(ev.changePct)})` : ""}; cost ${formatNzd(e.actualCostNzd)}.`, evidence: evidence.map((x) => `${x.kind.toLowerCase()}: ${x.description}`).join("; ") || "No evidence records attached.", whyItMatters: e.resultSummary ?? "—", next: e.nextAction ?? "—", owner: "Programme lead", reviewDate: inTwoWeeks(), illustrative: e.isIllustrative }] },
      ...(e.isDestinationLevel ? [{ heading: "Destination outcomes (kept separate)", bullets: [`Incremental visitors: ${formatNum(e.incrementalVisitors)}`, `Incremental guest nights: ${formatNum(e.incrementalGuestNights)}`, `Incremental local spend: ${formatNzd(e.incrementalSpendNzd)}`] }] : []),
      { heading: "Limitations & attribution", bullets: [...ev.caveats, ...(e.limitations ? [e.limitations] : []), ...(e.attributionNotes ? [e.attributionNotes] : [])] },
      { heading: "Decision", paragraphs: [e.decision ? DECISION_LABELS[e.decision] : "No decision recorded."] },
    ],
  };
}

export async function commercialReport(): Promise<Report> {
  const [deals, costs, scenarios] = await Promise.all([
    prisma.deal.findMany({ include: { payments: true }, orderBy: { stage: "asc" } }),
    prisma.costItem.findMany({ orderBy: { incurredAt: "asc" } }),
    prisma.pricingScenario.findMany(),
  ]);
  const c = summarise(deals, costs, 3);
  const renewals = deals.filter((d) => d.renewalDate && d.stage !== "LOST");
  return {
    title: "Monthly Commercial Summary",
    subtitle: "NZD excl. GST · planning view, not accounting",
    generatedAt: new Date(),
    audience: "Founder (internal)",
    notices: deals.some((d) => d.isIllustrative) || costs.some((x) => x.isIllustrative) ? [SYNTH] : [],
    sections: [
      { heading: "Revenue by stage — never summed together", table: { head: ["Stage", "Value"], rows: [["Received (actual)", formatNzd(c.received)], ["Contracted", formatNzd(c.contracted)], ["Contracted, not yet received", formatNzd(c.contractedOutstanding)], ["Quoted", formatNzd(c.byStage.QUOTED)], ["Proposed", formatNzd(c.byStage.PROPOSED)], ["Early opportunity", formatNzd(c.byStage.OPPORTUNITY)], ["Weighted pipeline (forecast only)", formatNzd(c.weightedPipeline)]] } },
      { heading: "Costs & margin", bullets: [`Actual costs: ${formatNzd(c.actualCosts)}`, `Forecast costs: ${formatNzd(c.forecastCosts)}`, `Gross margin on received: ${c.grossMarginOnReceived == null ? "—" : pct(c.grossMarginOnReceived)}`, `Projected margin on contracted (after forecast costs): ${c.grossMarginOnContracted == null ? "—" : pct(c.grossMarginOnContracted)}`] },
      { heading: "Pipeline", table: { head: ["Deal", "Type", "Stage", "Value", "Probability", "Received"], rows: deals.map((d) => [d.title, DEAL_TYPE_LABELS[d.type], DEAL_STAGE_LABELS[d.stage], formatNzd(dealValue(d)), `${d.probability}%`, formatNzd(d.payments.reduce((s, p) => s + p.amountNzd, 0))]) } },
      { heading: "Recurring & renewals", bullets: [`Recurring contracted per month: ${formatNzd(c.monthlyRecurringContracted)}`, ...renewals.map((d) => `${d.title}: renewal ${formatDate(d.renewalDate)}`)] },
      { heading: "Pricing scenarios on file", bullets: scenarios.map((s) => `${s.name}`) },
    ],
  };
}

export async function caseStudyDraft(operatorId: string): Promise<{ report: Report | null; blocked: string | null }> {
  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    include: { opportunities: { where: { status: { in: ["LIVE", "MEASURING", "CLOSED"] }, decision: { not: "STOP" } } }, experiments: { where: { status: "COMPLETE" } }, measurements: true },
  });
  if (!op) return { report: null, blocked: "Operator not found." };
  if (!op.consentCaseStudy) return { report: null, blocked: "This operator has not consented to public case-study use. Record consent on the operator's permissions before drafting." };
  const comps = compareMeasurements(op.measurements).filter((x) => x.change != null);
  const illustrative = op.isSynthetic || comps.some((x) => x.illustrative);
  return {
    blocked: null,
    report: {
      title: `Case study draft — ${op.name}`,
      subtitle: "DRAFT for operator review. Not for publication until the operator approves the final text.",
      generatedAt: new Date(),
      audience: "Operator (for approval), then public",
      notices: [
        "Every claim below must be checked with the operator. Remove anything they are not comfortable publishing.",
        "Do not include cultural narratives, imagery or kōrero without approval from the appropriate cultural authority.",
        ...(illustrative ? [SYNTH] : []),
      ],
      sections: [
        { heading: "The business", paragraphs: [op.experiences ?? `${op.name} is a ${op.category} operator in Rotorua.`] },
        { heading: "The challenge", paragraphs: [op.challenges ?? "[Describe the challenge in the operator's words]"] },
        { heading: "What we did", bullets: op.opportunities.map((o) => `${o.title} — ${o.proposedSolution} (${SOLUTION_LABELS[o.solutionType]})`) },
        { heading: "What changed", bullets: comps.map((x) => `${x.label ?? METRIC_LABELS[x.metric]}: ${formatNum(x.baseline)} → ${formatNum(x.result)} ${x.unit}${x.illustrative ? " [ILLUSTRATIVE — replace]" : ""}`), paragraphs: ["State the comparison method and any limitations next to each number."] },
        { heading: "In their words", paragraphs: ["[Operator quote — to be supplied and approved by the operator]"] },
      ],
    },
  };
}
