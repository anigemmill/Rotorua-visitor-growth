// AI usage allowance: metering, status and enforcement.
//
// Flow for every Claude call (wired into the orchestrator in Phase 3):
//   1. assertAiBudget(...)   — before the call, with a worst-case estimate
//                              from estimateCostMicros(); refuses if usage
//                              would pass the hard limit.
//   2. call the API
//   3. recordModelUsage(...) — after the call, with the real `usage`
//                              numbers; raises warning / limit alerts once
//                              per period.
//
// Periods are calendar months in UTC. Allowances are in USD because that is
// what the provider bills; customers see percentages, not dollar figures.
// See docs/platform/USAGE_ALLOWANCE.md.

import type { ModelRate } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit, type Actor, SYSTEM_ACTOR } from "./audit";
import type { Entitlements } from "./entitlements";
import { DomainError, EntitlementError } from "./errors";
import { assertCanOperate, type LicenseState } from "./licensing";
import type { TenantDb } from "./tenant-db";

const MICROS_PER_USD = 1_000_000;
const TOKENS_PER_MTOK = 1_000_000;

export class ModelRateMissingError extends DomainError {
  constructor(model: string) {
    super(`No price is configured for model ${model}; AI work is refused until one is added.`);
  }
}

export class AiAllowanceExceededError extends EntitlementError {
  constructor() {
    super("This workspace has reached its AI usage allowance for this month. New analysis resumes next month, or contact us to raise the allowance.");
  }
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  isBatch?: boolean;
}

export function monthPeriod(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

type Rate = Pick<
  ModelRate,
  "inputMicrosPerMTok" | "outputMicrosPerMTok" | "cacheReadMicrosPerMTok" | "cacheWriteMicrosPerMTok" | "batchDiscountPercent"
>;

/** Cost in micro-USD, rounded up so metering never under-charges. */
export function costMicros(rate: Rate, u: TokenUsage): number {
  for (const v of [u.inputTokens, u.outputTokens, u.cacheReadTokens ?? 0, u.cacheWriteTokens ?? 0]) {
    if (!Number.isInteger(v) || v < 0) throw new RangeError("Token counts must be non-negative integers.");
  }
  const raw =
    u.inputTokens * rate.inputMicrosPerMTok +
    u.outputTokens * rate.outputMicrosPerMTok +
    (u.cacheReadTokens ?? 0) * rate.cacheReadMicrosPerMTok +
    (u.cacheWriteTokens ?? 0) * rate.cacheWriteMicrosPerMTok;
  const discounted = u.isBatch ? (raw * (100 - rate.batchDiscountPercent)) / 100 : raw;
  return Math.ceil(discounted / TOKENS_PER_MTOK);
}

export async function getModelRate(model: string, at: Date = new Date(), provider = "anthropic"): Promise<ModelRate> {
  const rate = await prisma.modelRate.findFirst({
    where: { provider, model, effectiveFrom: { lte: at } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) throw new ModelRateMissingError(model);
  return rate;
}

/** Worst-case cost of a call before it is made (all input uncached, full output budget). */
export async function estimateCostMicros(
  model: string,
  input: { inputTokens: number; maxOutputTokens: number; isBatch?: boolean },
  at: Date = new Date()
): Promise<number> {
  const rate = await getModelRate(model, at);
  return costMicros(rate, { inputTokens: input.inputTokens, outputTokens: input.maxOutputTokens, isBatch: input.isBatch });
}

export type AiUsageState = "no_allowance" | "ok" | "warning" | "limit_reached";

export interface AiUsageStatus {
  state: AiUsageState;
  periodStart: Date;
  periodEnd: Date;
  usedMicrosUsd: number;
  allowanceMicrosUsd: number;
  hardLimitMicrosUsd: number;
  /** Share of the allowance used, 0–100+ (may exceed 100 up to the hard limit). */
  percentUsed: number;
  warnAtPercent: number;
}

export function classifyUsage(usedMicros: number, ai: Entitlements["ai"]): Omit<AiUsageStatus, "periodStart" | "periodEnd"> {
  if (!ai) {
    return { state: "no_allowance", usedMicrosUsd: usedMicros, allowanceMicrosUsd: 0, hardLimitMicrosUsd: 0, percentUsed: 0, warnAtPercent: 0 };
  }
  const allowance = Math.round(ai.monthlyAllowanceUsd * MICROS_PER_USD);
  const hardLimit = Math.round((allowance * ai.hardLimitPercent) / 100);
  const percentUsed = allowance ? (usedMicros / allowance) * 100 : 0;
  const state: AiUsageState =
    usedMicros >= hardLimit ? "limit_reached" : percentUsed >= ai.warnAtPercent ? "warning" : "ok";
  return { state, usedMicrosUsd: usedMicros, allowanceMicrosUsd: allowance, hardLimitMicrosUsd: hardLimit, percentUsed, warnAtPercent: ai.warnAtPercent };
}

async function usedThisPeriod(db: TenantDb, period: { start: Date; end: Date }): Promise<number> {
  const agg = await db.usageRecord.aggregate({
    where: { occurredAt: { gte: period.start, lt: period.end } },
    _sum: { costMicrosUsd: true },
  });
  return agg._sum.costMicrosUsd ?? 0;
}

export async function getAiUsageStatus(db: TenantDb, entitlements: Entitlements, now: Date = new Date()): Promise<AiUsageStatus> {
  const period = monthPeriod(now);
  const used = await usedThisPeriod(db, period);
  return { ...classifyUsage(used, entitlements.ai), periodStart: period.start, periodEnd: period.end };
}

/**
 * Pre-flight gate for AI work. Requires full licence access and an AI
 * allowance, and refuses if usage plus this call's worst-case estimate would
 * pass the hard limit.
 *
 * Concurrency note: two simultaneous runs can each pass this check. The
 * Phase 3 orchestrator serialises AI work per organisation (Postgres
 * advisory lock) so overshoot is bounded to one call's estimate.
 */
export async function assertAiBudget(
  db: TenantDb,
  license: LicenseState,
  estimatedMicrosUsd: number,
  now: Date = new Date()
): Promise<AiUsageStatus> {
  assertCanOperate(license);
  if (!license.entitlements.ai) throw new EntitlementError("Your plan does not include AI analysis.");
  const status = await getAiUsageStatus(db, license.entitlements, now);
  if (status.usedMicrosUsd + Math.max(0, estimatedMicrosUsd) > status.hardLimitMicrosUsd) {
    throw new AiAllowanceExceededError();
  }
  return status;
}

export interface RecordUsageInput extends TokenUsage {
  model: string;
  provider?: string;
  workflowKey?: string;
  agentKey?: string;
  referenceId?: string;
  /** Provider request id — the same id is never counted twice. */
  idempotencyKey?: string;
  occurredAt?: Date;
}

export async function recordModelUsage(
  db: TenantDb,
  organizationId: string,
  entitlements: Entitlements,
  input: RecordUsageInput,
  actor: Actor = SYSTEM_ACTOR
): Promise<AiUsageStatus> {
  const occurredAt = input.occurredAt ?? new Date();
  const rate = await getModelRate(input.model, occurredAt, input.provider);
  const cost = costMicros(rate, input);

  const isDuplicate = (e: { code?: string }) => {
    // Unique (organizationId, idempotencyKey): a retried or replayed call is never counted twice.
    if (e?.code === "P2002") return true;
    throw e;
  };
  const inserted = await db.usageRecord
    .create({
      data: {
        organizationId,
        occurredAt,
        provider: input.provider ?? "anthropic",
        model: input.model,
        workflowKey: input.workflowKey,
        agentKey: input.agentKey,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadTokens: input.cacheReadTokens ?? 0,
        cacheWriteTokens: input.cacheWriteTokens ?? 0,
        isBatch: input.isBatch ?? false,
        costMicrosUsd: cost,
      },
    })
    .then(() => true)
    .catch((e) => !isDuplicate(e));
  if (!inserted) return getAiUsageStatus(db, entitlements, occurredAt);

  const status = await getAiUsageStatus(db, entitlements, occurredAt);
  for (const level of ["warning", "limit_reached"] as const) {
    const crossed = level === "warning" ? status.state === "warning" || status.state === "limit_reached" : status.state === "limit_reached";
    if (!crossed) continue;
    // The unique (org, period, level) key makes each alert fire once per period.
    const created = await db.usageAlert
      .create({ data: { organizationId, periodStart: status.periodStart, level, usedMicrosUsd: status.usedMicrosUsd } })
      .then(() => true)
      .catch((e) => !isDuplicate(e));
    if (created) {
      await recordAudit({
        actor,
        organizationId,
        action: level === "warning" ? "usage.ai_warning" : "usage.ai_limit_reached",
        metadata: { percentUsed: Math.round(status.percentUsed), periodStart: status.periodStart.toISOString() },
      });
    }
  }
  return status;
}

/** Platform view: model cost per organisation for a period (staff only — call from admin.ts). */
export async function usageByOrganization(period = monthPeriod()) {
  const rows = await prisma.usageRecord.groupBy({
    by: ["organizationId"],
    where: { occurredAt: { gte: period.start, lt: period.end } },
    _sum: { costMicrosUsd: true, inputTokens: true, outputTokens: true },
    _count: { _all: true },
  });
  return rows.map((r) => ({
    organizationId: r.organizationId,
    costMicrosUsd: r._sum.costMicrosUsd ?? 0,
    inputTokens: r._sum.inputTokens ?? 0,
    outputTokens: r._sum.outputTokens ?? 0,
    calls: r._count._all,
  }));
}
