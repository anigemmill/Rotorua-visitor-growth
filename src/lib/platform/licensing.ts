// Licence state for a tenant, and the server-side gates every paid action
// passes through. All gates read the licence fresh from the database — no
// client-supplied plan or status is ever trusted.

import type { License, Plan, Product } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "./audit";
import {
  type AccessDecision,
  type Entitlements,
  type FeatureKey,
  type LimitKey,
  FEATURE_LABELS,
  hasFeature,
  LIMIT_LABELS,
  mergeEntitlements,
  resolveAccess,
  withinLimit,
} from "./entitlements";
import { ConflictError, EntitlementError, LimitExceededError, NotFoundError } from "./errors";
import type { OrgContext } from "./organizations";
import { requirePermission } from "./organizations";
import type { TenantDb } from "./tenant-db";

export { LIMIT_LABELS };

/** The first (and currently only) licensed ecosystem. */
export const TOURISM_PRODUCT_KEY = "tourism-intelligence";

export interface LicenseState {
  license: (License & { plan: Plan; product: Product }) | null;
  entitlements: Entitlements;
  access: AccessDecision;
}

const NO_ENTITLEMENTS: Entitlements = { features: {}, limits: {}, reporting: { cadences: [] }, support: { tier: "standard" }, ai: null };

export async function getLicenseState(
  db: TenantDb,
  productKey: string = TOURISM_PRODUCT_KEY,
  now: Date = new Date()
): Promise<LicenseState> {
  const license = await db.license.findFirst({
    where: { product: { key: productKey } },
    include: { plan: true, product: true },
  });
  if (!license) return { license: null, entitlements: NO_ENTITLEMENTS, access: resolveAccess(null, now) };
  const access = resolveAccess(license, now);
  // A tenant with no access gets no entitlements, whatever the plan says.
  const entitlements =
    access.mode === "none" ? NO_ENTITLEMENTS : mergeEntitlements(license.plan.entitlements, license.entitlementOverrides);
  return { license, entitlements, access };
}

/** Gate for anything that pulls new data, runs agents or spends money. */
export function assertCanOperate(state: LicenseState): void {
  if (state.access.mode !== "full") {
    throw new EntitlementError(`${state.access.reason} This action needs an active licence.`);
  }
}

export function assertFeature(state: LicenseState, feature: FeatureKey): void {
  assertCanOperate(state);
  if (!hasFeature(state.entitlements, feature)) {
    throw new EntitlementError(`${FEATURE_LABELS[feature]} is not included in your plan.`);
  }
}

export function assertWithinLimit(state: LicenseState, key: LimitKey, currentCount: number): void {
  if (!withinLimit(state.entitlements, key, currentCount)) {
    throw new LimitExceededError(LIMIT_LABELS[key], state.entitlements.limits[key] ?? 0);
  }
}

// ---------------------------------------------------------------------------
// Catalogue & self-serve trial
// ---------------------------------------------------------------------------

export async function listCatalogue() {
  return prisma.product.findMany({
    where: { active: true },
    include: {
      plans: { where: { active: true, isPublic: true }, orderBy: { sortOrder: "asc" } },
      versions: { where: { isCurrent: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Starts a self-serve trial. Only plans flagged `selfServeTrial` qualify, and
 * only if the workspace has never held a licence for the product (no
 * repeated trials). Paid plans are provisioned by staff or, once wired, by
 * the billing provider's webhook — never by a client request.
 */
export async function startTrial(ctx: OrgContext, planKey: string, now: Date = new Date()) {
  requirePermission(ctx, "license.manage");
  const plan = await prisma.plan.findUnique({ where: { key: planKey }, include: { product: true } });
  if (!plan || !plan.active || !plan.isPublic || !plan.product.active) throw new NotFoundError("Plan not found.");
  if (!plan.selfServeTrial || !plan.trialDays) {
    throw new EntitlementError("This plan can't be started online yet. Contact us to arrange access.");
  }
  const existing = await ctx.db.license.findFirst({ where: { productId: plan.productId } });
  if (existing) throw new ConflictError("This workspace already has a licence for this product.");

  const license = await ctx.db.license.create({
    data: {
      organizationId: ctx.organization.id,
      productId: plan.productId,
      planId: plan.id,
      status: "TRIALING",
      startsAt: now,
      trialEndsAt: new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000),
    },
  });
  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "license.trial_started",
    targetType: "License",
    targetId: license.id,
    metadata: { plan: plan.key },
  });
  return license;
}
