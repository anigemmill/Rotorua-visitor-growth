import Link from "next/link";
import {
  Badge, ButtonLink, Card, EmptyState, HorizonBadge, IllustrativeBadge, Notice, PageHeader, Progress, SeverityBadge, Stat, Table,
} from "@/components/ui";
import { requireStaff } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { activeProgramme } from "@/lib/queries";
import { programmePhaseLabel, programmeWeek, stageForWeek, weekStart } from "@/lib/domain/programme";
import { priorityScore } from "@/lib/domain/prioritise";
import { evaluateExperiment, VERDICT_LABELS } from "@/lib/domain/experiments";
import { summarise } from "@/lib/domain/commercial";
import { formatDate, formatNzd, formatShortDate } from "@/lib/format";

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"] as const;

export default async function DashboardPage() {
  const user = await requireStaff();
  const now = new Date();
  const programme = await activeProgramme();

  const [
    operators, overdueTasks, blockedTasks, risks, decisionsDue, projectsActive, experiments, opps, draftBriefs, deals, costs, syntheticCount,
  ] = await Promise.all([
    prisma.operator.findMany({
      where: { status: { notIn: ["WITHDRAWN", "PROSPECT"] } },
      select: {
        id: true, name: true, status: true, dataAgreementSignedAt: true,
        assessments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { measurements: { where: { kind: "BASELINE" } } } },
      },
    }),
    prisma.task.findMany({
      where: { status: { in: [...OPEN] }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { operator: { select: { id: true, name: true } } },
    }),
    prisma.task.count({ where: { status: "BLOCKED" } }),
    prisma.risk.findMany({ where: { status: { notIn: ["DONE", "CANCELLED"] }, severity: { in: ["HIGH", "CRITICAL"] } }, include: { operator: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.decisionRecord.findMany({ where: { decided: false }, orderBy: { reviewDate: { sort: "asc", nulls: "last" } }, take: 5 }),
    prisma.project.count({ where: { status: { in: ["IN_PROGRESS", "BLOCKED"] } } }),
    prisma.experiment.findMany({ include: { operator: { select: { name: true } }, initiative: { select: { title: true } } } }),
    prisma.opportunity.findMany({ where: { status: { notIn: ["CLOSED", "REJECTED"] } }, include: { operator: { select: { name: true } } } }),
    prisma.growthBrief.count({ where: { status: "DRAFT" } }),
    user.role === "FOUNDER" ? prisma.deal.findMany({ include: { payments: true } }) : Promise.resolve([]),
    user.role === "FOUNDER" ? prisma.costItem.findMany() : Promise.resolve([]),
    prisma.operator.count({ where: { isSynthetic: true } }),
  ]);

  const week = programme ? programmeWeek(programme.startDate, now, programme.totalWeeks) : 0;
  const stage = programme ? stageForWeek(programme.stages, week) : null;
  const upcomingMilestones = programme?.milestones.filter((m) => m.status !== "DONE" && m.week >= Math.max(1, week)).slice(0, 3) ?? [];
  const overdueMilestones = programme?.milestones.filter((m) => m.status !== "DONE" && m.week < week) ?? [];

  const active = operators.filter((o) => ["ACTIVE", "ONBOARDING"].includes(o.status));
  const assessed = operators.filter((o) => o.assessments[0]?.status === "COMPLETE").length;
  const noBaseline = active.filter((o) => o._count.measurements === 0);
  const noAgreement = active.filter((o) => !o.dataAgreementSignedAt);
  const running = experiments.filter((e) => e.status === "RUNNING");
  const expNoTarget = experiments.filter((e) => ["DESIGN", "RUNNING"].includes(e.status) && (e.baselineValue == null || (e.targetValue == null && e.minimumAcceptable == null)));
  const nowHypotheses = opps.filter((o) => o.horizon === "NOW" && o.evidenceBasis === "HYPOTHESIS");
  const evaluated = experiments
    .filter((e) => ["ANALYSING", "COMPLETE"].includes(e.status))
    .map((e) => ({ e, ev: evaluateExperiment({ ...e, hasIllustrativeData: e.isIllustrative }) }));
  const horizonCounts = (["NOW", "NEXT", "LATER", "IGNORE"] as const).map((h) => ({ h, n: opps.filter((o) => o.horizon === h).length }));
  const topNow = opps.filter((o) => o.horizon === "NOW").sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 5);
  const commercial = user.role === "FOUNDER" ? summarise(deals, costs, programme?.totalWeeks ? Math.ceil(programme.totalWeeks / 4.33) : 3) : null;
  const commercialIllustrative = deals.some((d) => d.isIllustrative) || costs.some((c) => c.isIllustrative);

  const attention = overdueTasks.length + risks.length + decisionsDue.filter((d) => d.reviewDate && d.reviewDate <= new Date(now.getTime() + 7 * 86400000)).length + overdueMilestones.length;

  return (
    <div>
      <PageHeader
        eyebrow={programme?.name ?? "No active programme"}
        title={`Kia ora, ${user.name.split(" ")[0]}`}
        description={attention ? `${attention} item${attention === 1 ? "" : "s"} need your attention this week.` : "Nothing urgent. Review what's next below."}
        actions={<ButtonLink href="/reports/founder">Programme report</ButtonLink>}
      />

      {syntheticCount > 0 && (
        <div className="mb-6">
          <Notice tone="warning">
            This workspace contains {syntheticCount} synthetic demo operators. All their measurements, experiment results and commercial figures are illustrative — not real results.
          </Notice>
        </div>
      )}

      {programme && (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium text-muted">{programmePhaseLabel(week, programme.totalWeeks)}</p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight">{stage?.name ?? (week === 0 ? `Starts ${formatDate(programme.startDate)}` : "Complete")}</p>
              {stage && <p className="text-xs text-subtle">Weeks {stage.startWeek}–{stage.endWeek} · {stage.goals.slice(0, 3).join(" · ")}</p>}
            </div>
            <div className="w-full md:w-80">
              <Progress value={Math.min(week, programme.totalWeeks)} max={programme.totalWeeks} label="Programme progress" />
              <div className="mt-2 flex justify-between text-[11px] text-subtle">
                {programme.stages.map((s) => <span key={s.id} className={s.id === stage?.id ? "font-medium text-accent" : ""}>{s.name.split(" ")[0]}</span>)}
              </div>
            </div>
          </div>
          {(upcomingMilestones.length > 0 || overdueMilestones.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-sm">
              {overdueMilestones.map((m) => <span key={m.id}><Badge tone="danger">Overdue</Badge> <span className="ml-1">{m.title}</span> <span className="text-xs text-subtle">wk {m.week}</span></span>)}
              {upcomingMilestones.map((m) => <span key={m.id}><Badge tone="outline">Wk {m.week}</Badge> <span className="ml-1">{m.title}</span> <span className="text-xs text-subtle">{formatShortDate(weekStart(programme.startDate, m.week))}</span></span>)}
            </div>
          )}
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Participating operators" value={active.length} sub={`${operators.length - active.length} invited / other`} href="/operators" />
        <Stat label="Assessments complete" value={`${assessed}/${operators.length}`} href="/assessments" tone={assessed < operators.length && week > 2 ? "warning" : "default"} />
        <Stat label="Overdue tasks" value={overdueTasks.length} sub={`${blockedTasks} blocked`} href="/work?view=overdue" tone={overdueTasks.length ? "danger" : "default"} />
        <Stat label="Projects in progress" value={projectsActive} href="/work" />
        <Stat label="Experiments running" value={running.length} sub={`${experiments.length} total`} href="/experiments" />
        <Stat label="Briefs awaiting review" value={draftBriefs} tone={draftBriefs ? "warning" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Needs action now" description="Overdue work, high risks and decisions due." padded={false}>
            {overdueTasks.length === 0 && risks.length === 0 && decisionsDue.length === 0 ? (
              <div className="p-5"><EmptyState title="Nothing overdue or high-risk" /></div>
            ) : (
              <Table>
                <tbody>
                  {risks.map((r) => (
                    <tr key={r.id}>
                      <td className="w-24"><SeverityBadge s={r.severity} /></td>
                      <td><Link href="/governance" className="font-medium hover:underline">{r.kind === "BLOCKER" ? "Blocker: " : "Risk: "}{r.title}</Link><p className="text-xs text-muted">{r.operator?.name ?? "Programme"} · owner {r.owner ?? "—"}</p></td>
                    </tr>
                  ))}
                  {overdueTasks.map((t) => (
                    <tr key={t.id}>
                      <td className="w-24"><Badge tone="danger">Overdue</Badge></td>
                      <td><Link href={t.operator ? `/operators/${t.operator.id}` : "/work?view=overdue"} className="font-medium hover:underline">{t.title}</Link><p className="text-xs text-muted">{t.operator?.name ?? "Programme"} · due {formatShortDate(t.dueDate)} · {t.ownerLabel ?? "staff"}</p></td>
                    </tr>
                  ))}
                  {decisionsDue.map((d) => (
                    <tr key={d.id}>
                      <td className="w-24"><Badge tone="info">Decision</Badge></td>
                      <td><Link href="/governance" className="font-medium hover:underline">{d.title}</Link><p className="text-xs text-muted">Review {formatShortDate(d.reviewDate)} · {d.owner ?? "no owner"}</p></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title="Opportunities by horizon" actions={<ButtonLink href="/opportunities">Register</ButtonLink>}>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {horizonCounts.map(({ h, n }) => (
                <Link key={h} href={`/opportunities?horizon=${h}`} className="rounded-lg border border-line p-3 hover:border-line-strong">
                  <HorizonBadge h={h} />
                  <p className="mt-1 text-xl font-semibold tabular-nums">{n}</p>
                </Link>
              ))}
            </div>
            {topNow.length > 0 && (
              <ul className="divide-y divide-line text-sm">
                {topNow.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0"><Link href={`/opportunities/${o.id}`} className="font-medium hover:underline">{o.title}</Link> <span className="text-xs text-muted">· {o.operator?.name ?? "Shared"}</span></span>
                    <span className="shrink-0 text-xs tabular-nums text-subtle">score {priorityScore(o)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Key results so far" description="Experiments in analysis or complete, judged against their pre-set thresholds." padded={false}>
            {evaluated.length === 0 ? (
              <div className="p-5"><EmptyState title="No results yet">Results appear once experiments reach analysis. Nothing is shown until then.</EmptyState></div>
            ) : (
              <Table>
                <tbody>
                  {evaluated.map(({ e, ev }) => (
                    <tr key={e.id}>
                      <td><Link href={`/experiments/${e.id}`} className="font-medium hover:underline">{e.title}</Link><p className="text-xs text-muted">{e.operator?.name ?? e.initiative?.title}</p></td>
                      <td className="whitespace-nowrap"><Badge tone={ev.verdict === "target_met" ? "success" : ev.verdict === "minimum_met" ? "info" : ev.verdict === "insufficient_data" ? "outline" : "danger"}>{VERDICT_LABELS[ev.verdict]}</Badge></td>
                      <td>{e.isIllustrative && <IllustrativeBadge />}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Evidence still required">
            <ul className="space-y-3 text-sm">
              <EvidenceRow n={noBaseline.length} label="operators have no baseline" items={noBaseline.map((o) => ({ href: `/results?operator=${o.id}`, label: o.name }))} />
              <EvidenceRow n={noAgreement.length} label="operators without a signed data agreement" items={noAgreement.map((o) => ({ href: `/operators/${o.id}`, label: o.name }))} />
              <EvidenceRow n={expNoTarget.length} label="experiments missing a baseline or target" items={expNoTarget.map((e) => ({ href: `/experiments/${e.id}`, label: e.title }))} />
              <EvidenceRow n={nowHypotheses.length} label="NOW opportunities resting on a hypothesis" items={nowHypotheses.map((o) => ({ href: `/opportunities/${o.id}`, label: o.title }))} />
            </ul>
          </Card>

          {commercial && (
            <Card title="Commercial" description="NZD excl. GST" actions={<ButtonLink href="/commercial">Open</ButtonLink>}>
              {commercialIllustrative && <div className="mb-3"><IllustrativeBadge /> <span className="text-xs text-muted">includes demo figures</span></div>}
              <dl className="space-y-2 text-sm">
                <Row label="Received" value={formatNzd(commercial.received)} strong />
                <Row label="Contracted" value={formatNzd(commercial.contracted)} />
                <Row label="Contracted, not yet received" value={formatNzd(commercial.contractedOutstanding)} />
                <Row label="Quoted" value={formatNzd(commercial.byStage.QUOTED)} />
                <Row label="Proposed" value={formatNzd(commercial.byStage.PROPOSED)} />
                <Row label="Weighted pipeline (forecast only)" value={formatNzd(commercial.weightedPipeline)} />
                <Row label="Recurring contracted / month" value={formatNzd(commercial.monthlyRecurringContracted)} />
              </dl>
            </Card>
          )}

          <Card title="Strategic horizon">
            <ul className="space-y-2 text-sm">
              <li><HorizonBadge h="NOW" /> <span className="ml-1">Deliver the pilot, baselines, implementations, collective, case studies</span></li>
              <li><HorizonBadge h="NEXT" /> <span className="ml-1">Recurring operator intelligence · Rotorua Pulse · Stay Another Night test · validate Open Experience Network demand</span></li>
              <li><HorizonBadge h="LATER" /> <span className="ml-1">Verified bookable data · Rotorua Host prototype · licensing</span></li>
              <li><HorizonBadge h="IGNORE" /> <span className="ml-1">Public marketplace, autonomous agents, custom booking integrations (for now)</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EvidenceRow({ n, label, items }: { n: number; label: string; items: { href: string; label: string }[] }) {
  return (
    <li>
      <p><span className={`font-semibold tabular-nums ${n ? "text-warning" : "text-success"}`}>{n}</span> {label}</p>
      {n > 0 && (
        <p className="mt-0.5 text-xs text-muted">
          {items.slice(0, 4).map((it, i) => <span key={it.href}>{i > 0 && ", "}<Link href={it.href} className="hover:underline">{it.label}</Link></span>)}
          {items.length > 4 && ` +${items.length - 4} more`}
        </p>
      )}
    </li>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
