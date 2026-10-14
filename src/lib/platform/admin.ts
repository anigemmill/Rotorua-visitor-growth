// Platform-staff services. This is the only module that reads across
// tenants, so every entry point checks the caller's platform role first and
// every view of a specific customer's data is itself audited.
//
// SUPPORT: read-only. SUPER_ADMIN: may also change licences.

import * as z from "zod";
import { Prisma, type LicenseStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit, type Actor } from "./audit";
import { fieldErrors, type PublicUser } from "./auth";
import { EntitlementOverridesSchema, mergeEntitlements, resolveAccess } from "./entitlements";
import { getAiUsageStatus, monthPeriod, usageByOrganization } from "./usage";
import { tenantDb } from "./tenant-db";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { canManagePlatform, isPlatformStaff } from "./permissions";

export interface StaffContext {
  user: PublicUser;
  actor: Actor;
}

export function requireStaff(user: PublicUser, actor: Actor): StaffContext {
  if (!isPlatformStaff(user.platformRole)) throw new NotFoundError("Not found.");
  return { user, actor };
}

function requireSuperAdmin(staff: StaffContext): void {
  if (!canManagePlatform(staff.user.platformRole)) {
    throw new ForbiddenError("Only platform super-admins can change licences.");
  }
}

export async function platformOverview() {
  const [organizations, users, licenses, connectionsInError, recentFailures] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.license.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.integrationConnection.count({ where: { status: "ERROR" } }),
    prisma.auditEvent.count({
      where: { action: "auth.login_failed", createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    }),
  ]);
  return {
    organizations,
    users,
    licensesByStatus: Object.fromEntries(licenses.map((l) => [l.status, l._count._all])) as Partial<
      Record<LicenseStatus, number>
    >,
    connectionsInError,
    failedLoginsLast24h: recentFailures,
  };
}

export async function listOrganizations() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenses: { include: { plan: { select: { name: true } }, product: { select: { name: true } } } },
      _count: { select: { memberships: true, integrations: { where: { status: { not: "REVOKED" } } } } },
    },
    take: 500,
  });
  const now = new Date();
  return orgs.map((o) => ({
    ...o,
    licenses: o.licenses.map((l) => ({ ...l, access: resolveAccess(l, now) })),
  }));
}

export async function getOrganizationDetail(staff: StaffContext, organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: { include: { user: { select: { id: true, email: true, name: true, lastLoginAt: true } } } },
      licenses: { include: { plan: true, product: true } },
      profile: { select: { businessName: true, website: true, country: true, timeZone: true, businessType: true } },
      brands: { select: { id: true, name: true, website: true } },
      integrations: {
        // Credentials are never selected into staff views either.
        select: {
          id: true,
          providerKey: true,
          status: true,
          externalAccountId: true,
          connectedAt: true,
          lastSuccessfulSyncAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
        },
      },
    },
  });
  if (!org) throw new NotFoundError("Organisation not found.");
  await recordAudit({
    actor: staff.actor,
    organizationId: org.id,
    action: "admin.org_viewed",
    targetType: "Organization",
    targetId: org.id,
  });
  const now = new Date();
  const current = org.licenses[0];
  const aiUsage = current
    ? await getAiUsageStatus(tenantDb(org.id), mergeEntitlements(current.plan.entitlements, current.entitlementOverrides), now)
    : null;
  return {
    ...org,
    aiUsage,
    licenses: org.licenses.map((l) => ({
      ...l,
      access: resolveAccess(l, now),
      entitlements: mergeEntitlements(l.plan.entitlements, l.entitlementOverrides),
    })),
  };
}

export async function listPlans() {
  return prisma.product.findMany({
    include: { plans: { orderBy: { sortOrder: "asc" } }, versions: { orderBy: { releasedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
}

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Enter a valid date.");

export const LicenseUpdateSchema = z.object({
  planKey: z.string().min(1, "Choose a plan."),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "SUSPENDED"]),
  trialEndsAt: optionalDate,
  currentPeriodEnd: optionalDate,
  graceDays: z.coerce.number().int().min(0).max(90).default(7),
  /** AI allowance top-up for this licence (USD/month). Blank = use the plan's allowance. */
  aiAllowanceUsd: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 100_000), "Enter a positive amount."),
  aiHardLimitPercent: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 100 && v <= 200), "Enter a whole number from 100 to 200."),
  notes: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim().slice(0, 2000) : null)),
});

/** Grants or updates an organisation's licence for the plan's product. */
export async function setLicense(staff: StaffContext, organizationId: string, input: z.input<typeof LicenseUpdateSchema>) {
  requireSuperAdmin(staff);
  const parsed = LicenseUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  const { planKey, status, trialEndsAt, currentPeriodEnd, graceDays, notes, aiAllowanceUsd, aiHardLimitPercent } = parsed.data;

  if (status === "TRIALING" && !trialEndsAt) {
    throw new ValidationError("A trial needs an end date.", { trialEndsAt: ["Required for trials."] });
  }
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new NotFoundError("Organisation not found.");
  const plan = await prisma.plan.findUnique({ where: { key: planKey } });
  if (!plan) throw new ValidationError("Unknown plan.", { planKey: ["Unknown plan."] });

  const before = await prisma.license.findUnique({
    where: { organizationId_productId: { organizationId, productId: plan.productId } },
  });
  // Merge the AI override into any existing overrides, keeping other sections.
  const existingOverrides = before?.entitlementOverrides
    ? EntitlementOverridesSchema.parse(before.entitlementOverrides)
    : {};
  const aiOverride = {
    ...(aiAllowanceUsd !== null ? { monthlyAllowanceUsd: aiAllowanceUsd } : {}),
    ...(aiHardLimitPercent !== null ? { hardLimitPercent: aiHardLimitPercent } : {}),
  };
  const otherOverrides = { ...existingOverrides };
  delete otherOverrides.ai;
  const entitlementOverrides = { ...otherOverrides, ...(Object.keys(aiOverride).length ? { ai: aiOverride } : {}) };
  // Validate the result against the plan before saving (fails on e.g. a hard limit below warnAt).
  mergeEntitlements(plan.entitlements, entitlementOverrides);

  const data = {
    entitlementOverrides: Object.keys(entitlementOverrides).length ? entitlementOverrides : Prisma.DbNull,
    planId: plan.id,
    status,
    trialEndsAt,
    currentPeriodEnd,
    graceDays,
    notes,
    cancelledAt: status === "CANCELLED" ? (before?.cancelledAt ?? new Date()) : null,
  };
  const license = await prisma.license.upsert({
    where: { organizationId_productId: { organizationId, productId: plan.productId } },
    create: { ...data, organizationId, productId: plan.productId },
    update: data,
  });
  await recordAudit({
    actor: staff.actor,
    organizationId,
    action: before ? "license.updated" : "license.granted",
    targetType: "License",
    targetId: license.id,
    metadata: {
      before: before ? { status: before.status, planId: before.planId } : null,
      after: { status, plan: planKey, aiOverride: Object.keys(aiOverride).length ? aiOverride : null },
    },
  });
  return license;
}

export async function listAuditEvents(filter: { organizationId?: string; action?: string; take?: number } = {}) {
  return prisma.auditEvent.findMany({
    where: {
      organizationId: filter.organizationId,
      action: filter.action ? { startsWith: filter.action } : undefined,
    },
    include: { organization: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.take ?? 200, 500),
  });
}

export async function integrationHealth() {
  return prisma.integrationConnection.findMany({
    where: { status: { not: "REVOKED" } },
    select: {
      id: true,
      providerKey: true,
      status: true,
      externalAccountId: true,
      lastSuccessfulSyncAt: true,
      lastErrorAt: true,
      lastErrorMessage: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 500,
  });
}

/** Model cost per customer this month, highest first (platform cost view). */
export async function aiCostThisMonth() {
  const period = monthPeriod();
  const rows = await usageByOrganization(period);
  const orgs = await prisma.organization.findMany({
    where: { id: { in: rows.map((r) => r.organizationId) } },
    select: { id: true, name: true },
  });
  const names = new Map(orgs.map((o) => [o.id, o.name]));
  return {
    period,
    totalMicrosUsd: rows.reduce((n, r) => n + r.costMicrosUsd, 0),
    rows: rows
      .map((r) => ({ ...r, name: names.get(r.organizationId) ?? r.organizationId }))
      .sort((a, b) => b.costMicrosUsd - a.costMicrosUsd),
  };
}
