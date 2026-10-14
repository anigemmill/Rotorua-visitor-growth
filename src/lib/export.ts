import "server-only";
import { prisma } from "@/lib/prisma";

// Entities available for export. Credentials, session tokens and password
// hashes are never exported.
export const EXPORTS = {
  operators: { label: "Operators", founderOnly: false, load: () => prisma.operator.findMany({ orderBy: { name: "asc" } }) },
  assessments: { label: "Assessment area scores", founderOnly: false, load: () => prisma.assessmentAreaScore.findMany({ include: { assessment: { select: { operatorId: true, status: true, conductedAt: true } } } }).then((r) => r.map(({ assessment, ...x }) => ({ ...x, operatorId: assessment.operatorId, assessmentStatus: assessment.status, conductedAt: assessment.conductedAt }))) },
  opportunities: { label: "Opportunity register", founderOnly: false, load: () => prisma.opportunity.findMany() },
  projects: { label: "Projects", founderOnly: false, load: () => prisma.project.findMany() },
  tasks: { label: "Tasks", founderOnly: false, load: () => prisma.task.findMany() },
  experiments: { label: "Experiments", founderOnly: false, load: () => prisma.experiment.findMany() },
  measurements: { label: "Measurements (baselines & results)", founderOnly: false, load: () => prisma.measurement.findMany() },
  evidence: { label: "Evidence", founderOnly: false, load: () => prisma.evidence.findMany() },
  signals: { label: "Growth Intelligence signals", founderOnly: false, load: () => prisma.signal.findMany() },
  briefs: { label: "Weekly growth briefs", founderOnly: false, load: () => prisma.growthBrief.findMany() },
  workshops: { label: "Workshops", founderOnly: false, load: () => prisma.workshop.findMany() },
  attendance: { label: "Workshop attendance", founderOnly: false, load: () => prisma.workshopAttendance.findMany() },
  learnings: { label: "Learnings", founderOnly: false, load: () => prisma.learning.findMany() },
  resources: { label: "Resources", founderOnly: false, load: () => prisma.resource.findMany() },
  initiatives: { label: "Shared initiatives", founderOnly: false, load: () => prisma.sharedInitiative.findMany() },
  participants: { label: "Initiative participants", founderOnly: false, load: () => prisma.initiativeParticipant.findMany() },
  workflows: { label: "Agent & workflow library", founderOnly: false, load: () => prisma.workflowAsset.findMany() },
  workflowVersions: { label: "Workflow versions", founderOnly: false, load: () => prisma.workflowVersion.findMany() },
  templates: { label: "Solution templates", founderOnly: false, load: () => prisma.solutionTemplate.findMany() },
  risks: { label: "Risks", founderOnly: false, load: () => prisma.risk.findMany() },
  decisions: { label: "Decisions", founderOnly: false, load: () => prisma.decisionRecord.findMany() },
  programme: { label: "Programme, stages & milestones", founderOnly: false, load: () => prisma.programme.findMany({ include: { stages: true, milestones: true } }) },
  deals: { label: "Deals", founderOnly: true, load: () => prisma.deal.findMany() },
  payments: { label: "Payments", founderOnly: true, load: () => prisma.payment.findMany() },
  costs: { label: "Costs", founderOnly: true, load: () => prisma.costItem.findMany() },
  scenarios: { label: "Pricing scenarios", founderOnly: true, load: () => prisma.pricingScenario.findMany() },
  users: { label: "Users (no credentials)", founderOnly: true, load: () => prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, operatorId: true, active: true, lastLoginAt: true, createdAt: true } }) },
  audit: { label: "Audit log", founderOnly: true, load: () => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } }) },
} as const;

export type ExportKey = keyof typeof EXPORTS;
