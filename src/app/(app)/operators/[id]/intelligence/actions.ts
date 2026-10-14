"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { visibilityChangeError } from "@/lib/authz";
import { f, parseForm, type ActionState } from "@/lib/forms";
import { buildBrief } from "@/lib/domain/brief";
import { definitionFor } from "@/lib/integrations/registry";

const CLAIM = z.enum(["FACT", "OBSERVATION", "INFERENCE", "HYPOTHESIS", "RECOMMENDATION"]);

const signalSchema = z.object({
  type: f.str(),
  title: f.str(),
  summary: f.str(),
  claimType: CLAIM,
  source: f.str(),
  sourceTimestamp: f.date(),
  evidence: f.optStr(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  momentum: f.optStr(),
  commercialPotential: f.optStr(),
  visibility: z.enum(["INTERNAL", "CONFIDENTIAL", "COHORT", "AGGREGATE_APPROVED", "PUBLIC_APPROVED"]),
});

export async function addSignal(operatorId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = parseForm(signalSchema, fd);
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const op = await prisma.operator.findUniqueOrThrow({ where: { id: operatorId } });
    const err = visibilityChangeError(parsed.data.visibility, op);
    if (err) return { error: err };
    const d = parsed.data;
    const s = await prisma.signal.create({
      data: {
        ...d, operatorId, evidence: d.evidence ?? null, momentum: d.momentum ?? null,
        commercialPotential: d.commercialPotential ?? null, createdBy: user.name,
      },
    });
    await audit(user.id, "create", "signal", s.id, `Signal: ${s.title}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Signal recorded" };
  });
}

export async function setIntegration(operatorId: string, sourceKey: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  if (!definitionFor(sourceKey)) return { error: "Unknown source" };
  const parsed = parseForm(
    z.object({
      status: z.enum(["CONNECTED", "NOT_CONNECTED", "MANUAL_IMPORT", "REQUIRES_API", "REQUIRES_USER_AUTH"]),
      notes: f.optStr(),
      lastSyncedAt: f.optDate(),
    }),
    fd
  );
  if (parsed.error) return parsed.error;
  if (parsed.data.status === "CONNECTED" && !parsed.data.lastSyncedAt) {
    return { error: "Only mark a source Connected after a successful tested sync — record its date." };
  }
  return guarded(async () => {
    const data = { status: parsed.data.status, notes: parsed.data.notes ?? null, lastSyncedAt: parsed.data.lastSyncedAt ?? null };
    await prisma.integrationConnection.upsert({
      where: { operatorId_sourceKey: { operatorId, sourceKey } },
      update: data,
      create: { operatorId, sourceKey, ...data },
    });
    await audit(user.id, "update", "integration", operatorId, `${sourceKey} → ${data.status}`);
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Saved" };
  });
}

/** Builds a DRAFT brief deterministically from stored data. */
export async function generateBrief(operatorId: string): Promise<ActionState> {
  const user = await requireStaff();
  return guarded(async () => {
    const weekOf = new Date();
    const [signals, opportunities, tasks, experiments, baselineCount] = await Promise.all([
      prisma.signal.findMany({ where: { operatorId } }),
      prisma.opportunity.findMany({ where: { operatorId } }),
      prisma.task.findMany({ where: { operatorId }, include: { assignee: { select: { name: true } } } }),
      prisma.experiment.findMany({ where: { operatorId } }),
      prisma.measurement.count({ where: { operatorId, kind: "BASELINE" } }),
    ]);
    const draft = buildBrief({
      weekOf,
      signals,
      opportunities,
      tasks: tasks.map((t) => ({ ...t, assigneeName: t.assignee?.name ?? null })),
      experiments,
      hasBaseline: baselineCount > 0,
    });
    const b = await prisma.growthBrief.create({
      data: {
        operatorId, weekOf, whatChanged: draft.whatChanged, whyItMatters: draft.whyItMatters, actions: draft.actions as never,
        learnings: draft.learnings, dataGaps: draft.dataGaps, generatedBy: "rules", createdBy: user.name,
      },
    });
    await audit(user.id, "create", "brief", b.id, "Generated draft weekly brief");
    revalidatePath(`/operators/${operatorId}/intelligence`);
    return { ok: "Draft brief generated — review before approving" };
  });
}

export async function reviewBrief(briefId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = parseForm(
    z.object({ whyItMatters: f.optStr(), learnings: f.optStr(), status: z.enum(["DRAFT", "APPROVED", "SHARED"]) }),
    fd
  );
  if (parsed.error) return parsed.error;
  return guarded(async () => {
    const b = await prisma.growthBrief.findUniqueOrThrow({ where: { id: briefId } });
    const approving = parsed.data.status !== "DRAFT" && b.status === "DRAFT";
    await prisma.growthBrief.update({
      where: { id: briefId },
      data: {
        whyItMatters: parsed.data.whyItMatters ?? null,
        learnings: parsed.data.learnings ?? null,
        status: parsed.data.status,
        ...(approving ? { approvedBy: user.name, approvedAt: new Date() } : {}),
        ...(parsed.data.status === "DRAFT" ? { approvedBy: null, approvedAt: null } : {}),
      },
    });
    await audit(user.id, "update", "brief", briefId, `Brief → ${parsed.data.status}`);
    revalidatePath(`/operators/${b.operatorId}/intelligence`);
    return { ok: parsed.data.status === "SHARED" ? "Shared with operator" : "Saved" };
  });
}
