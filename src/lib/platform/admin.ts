// Platform-staff services. This is the only module that reads across
// tenants, so every entry point checks the caller's platform role first and
// every view of a specific customer's data is itself audited.
//
// SUPPORT: read-only. SUPER_ADMIN: may also change licences.

import * as z from "zod";
import type { LicenseStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit, type Actor } from "./audit";
import { fieldErrors, type PublicUser } from "./auth";
import { mergeEntitlements, resolveAccess } from "./entitlements";
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
  return {
    ...org,
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
  const { planKey, status, trialEndsAt, currentPeriodEnd, graceDays, notes } = parsed.data;

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
  const data = {
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
      after: { status, plan: planKey },
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
