// Enum → badge mappings so every status reads the same across the app.

import type {
  AssessmentStatus, ConfidenceLevel, DealStage, EvidenceKind, ExperimentStatus, Horizon, OperatorStatus,
  OpportunityStatus, Severity, Visibility, WorkStatus, WorkflowStatus, Decision as DecisionT, WorkflowKind,
} from "@/generated/prisma";
import {
  ASSESSMENT_STATUS_LABELS, CONFIDENCE_LABELS, DEAL_STAGE_LABELS, DECISION_LABELS, EVIDENCE_LABELS,
  EXPERIMENT_STATUS_LABELS, HORIZON_LABELS, OPERATOR_STATUS_LABELS, OPP_STATUS_LABELS, SEVERITY_LABELS,
  VISIBILITY_LABELS, WORK_STATUS_LABELS, WORKFLOW_KIND_LABELS, WORKFLOW_STATUS_LABELS,
} from "@/lib/labels";
import { Badge, type Tone } from "./primitives";

const work: Record<WorkStatus, Tone> = { TODO: "neutral", IN_PROGRESS: "info", BLOCKED: "danger", DONE: "success", CANCELLED: "outline" };
export const WorkStatusBadge = ({ s }: { s: WorkStatus }) => <Badge tone={work[s]}>{WORK_STATUS_LABELS[s]}</Badge>;

const op: Record<OperatorStatus, Tone> = {
  PROSPECT: "outline", INVITED: "neutral", ONBOARDING: "info", ACTIVE: "success", PAUSED: "warning", COMPLETED: "accent", WITHDRAWN: "outline",
};
export const OperatorStatusBadge = ({ s }: { s: OperatorStatus }) => <Badge tone={op[s]}>{OPERATOR_STATUS_LABELS[s]}</Badge>;

const hz: Record<Horizon, Tone> = { NOW: "accent", NEXT: "info", LATER: "neutral", IGNORE: "outline" };
export const HorizonBadge = ({ h }: { h: Horizon }) => <Badge tone={hz[h]}>{HORIZON_LABELS[h]}</Badge>;

const opp: Record<OpportunityStatus, Tone> = {
  IDENTIFIED: "neutral", PRIORITISED: "info", APPROVED: "accent", IN_PROGRESS: "info", LIVE: "success", MEASURING: "warning", CLOSED: "outline", REJECTED: "outline",
};
export const OppStatusBadge = ({ s }: { s: OpportunityStatus }) => <Badge tone={opp[s]}>{OPP_STATUS_LABELS[s]}</Badge>;

const asst: Record<AssessmentStatus, Tone> = { NOT_STARTED: "outline", IN_PROGRESS: "info", IN_REVIEW: "warning", COMPLETE: "success" };
export const AssessmentStatusBadge = ({ s }: { s: AssessmentStatus }) => <Badge tone={asst[s]}>{ASSESSMENT_STATUS_LABELS[s]}</Badge>;

const exp: Record<ExperimentStatus, Tone> = { DESIGN: "neutral", RUNNING: "info", ANALYSING: "warning", COMPLETE: "success", ABANDONED: "outline" };
export const ExperimentStatusBadge = ({ s }: { s: ExperimentStatus }) => <Badge tone={exp[s]}>{EXPERIMENT_STATUS_LABELS[s]}</Badge>;

const conf: Record<ConfidenceLevel, Tone> = { LOW: "warning", MEDIUM: "neutral", HIGH: "success" };
export const ConfidenceBadge = ({ c }: { c: ConfidenceLevel }) => <Badge tone={conf[c]}>{CONFIDENCE_LABELS[c]} confidence</Badge>;

const ev: Record<EvidenceKind, Tone> = { OBSERVED: "success", MEASURED: "success", OPERATOR_REPORTED: "info", THIRD_PARTY: "neutral", HYPOTHESIS: "warning" };
export const EvidenceBadge = ({ k }: { k: EvidenceKind }) => <Badge tone={ev[k]}>{EVIDENCE_LABELS[k]}</Badge>;

const vis: Record<Visibility, Tone> = { INTERNAL: "neutral", CONFIDENTIAL: "warning", COHORT: "info", AGGREGATE_APPROVED: "accent", PUBLIC_APPROVED: "success" };
export const VisibilityBadge = ({ v }: { v: Visibility }) => <Badge tone={vis[v]}>{VISIBILITY_LABELS[v]}</Badge>;

const sev: Record<Severity, Tone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger", CRITICAL: "danger" };
export const SeverityBadge = ({ s }: { s: Severity }) => <Badge tone={sev[s]}>{SEVERITY_LABELS[s]}</Badge>;

const wf: Record<WorkflowStatus, Tone> = { CONCEPT: "outline", TESTING: "warning", VALIDATED: "info", OPERATIONAL: "success", RETIRED: "neutral" };
export const WorkflowStatusBadge = ({ s }: { s: WorkflowStatus }) => <Badge tone={wf[s]}>{WORKFLOW_STATUS_LABELS[s]}</Badge>;
export const WorkflowKindBadge = ({ k }: { k: WorkflowKind }) => <Badge tone="neutral">{WORKFLOW_KIND_LABELS[k]}</Badge>;

const stage: Record<DealStage, Tone> = { OPPORTUNITY: "outline", PROPOSED: "neutral", QUOTED: "info", CONTRACTED: "success", LOST: "outline" };
export const DealStageBadge = ({ s }: { s: DealStage }) => <Badge tone={stage[s]}>{DEAL_STAGE_LABELS[s]}</Badge>;

const dec: Record<DecisionT, Tone> = { SCALE: "success", AMEND: "warning", STOP: "danger", INVESTIGATE: "info" };
export const DecisionBadge = ({ d }: { d: DecisionT | null }) =>
  d ? <Badge tone={dec[d]}>{DECISION_LABELS[d]}</Badge> : <Badge tone="outline">No decision</Badge>;

export const IllustrativeBadge = () => (
  <Badge tone="warning" title="Synthetic demonstration value — not a real result">Illustrative</Badge>
);
export const SyntheticBadge = () => (
  <Badge tone="warning" title="Synthetic demo operator — not a real business">Demo data</Badge>
);
