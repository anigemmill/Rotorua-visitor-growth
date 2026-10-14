import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EntitlementError } from "@/lib/platform/errors";
import { getLicenseState, startTrial } from "@/lib/platform/licensing";
import {
  AiAllowanceExceededError,
  assertAiBudget,
  estimateCostMicros,
  getAiUsageStatus,
  ModelRateMissingError,
  recordModelUsage,
} from "@/lib/platform/usage";
import { makeCatalogue, makeModelRates, makeOrg, resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  await makeModelRates();
});

const NOW = new Date("2026-10-14T00:00:00Z");
// 1M input tokens on Opus 5.5 = US$4.00. Test plan allowance = US$10, hard limit 100%.
const FOUR_DOLLARS = { model: "claude-opus-5-5", inputTokens: 1_000_000, outputTokens: 0, occurredAt: NOW };

async function licensedOrg(name = "Usage Co") {
  await makeCatalogue();
  const { ctx } = await makeOrg(name);
  await startTrial(ctx, "tourism-pilot", new Date("2026-10-01T00:00:00Z"));
  const license = await getLicenseState(ctx.db, undefined, NOW);
  return { ctx, license };
}

describe("AI usage allowance", () => {
  it("meters cost, warns once at 80%, then refuses work past the hard limit", async () => {
    const { ctx, license } = await licensedOrg();
    const e = license.entitlements;

    let s = await recordModelUsage(ctx.db, ctx.organization.id, e, { ...FOUR_DOLLARS, idempotencyKey: "req_1" });
    expect(s).toMatchObject({ state: "ok", usedMicrosUsd: 4_000_000 });

    s = await recordModelUsage(ctx.db, ctx.organization.id, e, { ...FOUR_DOLLARS, idempotencyKey: "req_2" });
    expect(s.state).toBe("warning"); // $8 of $10
    await recordModelUsage(ctx.db, ctx.organization.id, e, { model: "claude-opus-5-5", inputTokens: 100, outputTokens: 0, occurredAt: NOW });
    expect(await prisma.auditEvent.count({ where: { action: "usage.ai_warning" } })).toBe(1);

    // A $4 worst-case estimate would pass the $10 hard limit.
    const estimate = await estimateCostMicros("claude-opus-5-5", { inputTokens: 1_000_000, maxOutputTokens: 0 }, NOW);
    await expect(assertAiBudget(ctx.db, license, estimate, NOW)).rejects.toBeInstanceOf(AiAllowanceExceededError);
    // A small call still fits.
    await expect(assertAiBudget(ctx.db, license, 100_000, NOW)).resolves.toMatchObject({ state: "warning" });

    s = await recordModelUsage(ctx.db, ctx.organization.id, e, { ...FOUR_DOLLARS, idempotencyKey: "req_3" });
    expect(s.state).toBe("limit_reached");
    expect(await prisma.auditEvent.count({ where: { action: "usage.ai_limit_reached" } })).toBe(1);
    await expect(assertAiBudget(ctx.db, license, 0, NOW)).rejects.toBeInstanceOf(AiAllowanceExceededError);
  });

  it("never counts the same provider request twice", async () => {
    const { ctx, license } = await licensedOrg();
    await recordModelUsage(ctx.db, ctx.organization.id, license.entitlements, { ...FOUR_DOLLARS, idempotencyKey: "req_x" });
    const s = await recordModelUsage(ctx.db, ctx.organization.id, license.entitlements, { ...FOUR_DOLLARS, idempotencyKey: "req_x" });
    expect(s.usedMicrosUsd).toBe(4_000_000);
    expect(await ctx.db.usageRecord.count()).toBe(1);
  });

  it("resets each calendar month and keeps tenants separate", async () => {
    const a = await licensedOrg("Tenant A");
    const b = await (async () => {
      const { ctx } = await makeOrg("Tenant B");
      await startTrial(ctx, "tourism-pilot", new Date("2026-10-01T00:00:00Z"));
      return { ctx, license: await getLicenseState(ctx.db, undefined, NOW) };
    })();
    await recordModelUsage(a.ctx.db, a.ctx.organization.id, a.license.entitlements, { ...FOUR_DOLLARS, inputTokens: 3_000_000 });
    expect((await getAiUsageStatus(a.ctx.db, a.license.entitlements, NOW)).state).toBe("limit_reached");
    expect((await getAiUsageStatus(b.ctx.db, b.license.entitlements, NOW)).usedMicrosUsd).toBe(0);
    expect((await getAiUsageStatus(a.ctx.db, a.license.entitlements, new Date("2026-11-02T00:00:00Z"))).usedMicrosUsd).toBe(0);
  });

  it("licence overrides raise the allowance (staff top-up)", async () => {
    const { ctx } = await licensedOrg();
    await ctx.db.license.updateMany({ data: { entitlementOverrides: { ai: { monthlyAllowanceUsd: 50 } } } });
    const license = await getLicenseState(ctx.db, undefined, NOW);
    await recordModelUsage(ctx.db, ctx.organization.id, license.entitlements, { ...FOUR_DOLLARS, inputTokens: 3_000_000 });
    await expect(assertAiBudget(ctx.db, license, 0, NOW)).resolves.toMatchObject({ state: "ok" });
  });

  it("refuses AI work without an operable licence, an allowance or a known price", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("No licence");
    await expect(assertAiBudget(ctx.db, await getLicenseState(ctx.db, undefined, NOW), 0, NOW)).rejects.toBeInstanceOf(
      EntitlementError
    );
    await expect(estimateCostMicros("claude-unknown", { inputTokens: 1, maxOutputTokens: 1 }, NOW)).rejects.toBeInstanceOf(
      ModelRateMissingError
    );
    const { ctx: c2 } = await makeOrg("Expired");
    await startTrial(c2, "tourism-pilot", new Date("2026-10-01T00:00:00Z"));
    const license = await getLicenseState(c2.db, undefined, NOW);
    await c2.db.license.updateMany({ data: { trialEndsAt: new Date("2026-10-02T00:00:00Z") } });
    const expired = await getLicenseState(c2.db, undefined, NOW);
    expect(expired.access.mode).toBe("read_only");
    await expect(assertAiBudget(c2.db, expired, 0, NOW)).rejects.toBeInstanceOf(EntitlementError);
    expect(license.access.mode).toBe("full");
  });
});
