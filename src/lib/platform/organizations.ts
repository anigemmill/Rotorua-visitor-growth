// Organisations (tenants), memberships and the per-request OrgContext.
//
// getOrgContext() is the single entry point for any customer-facing
// operation on tenant data: it proves the user is a member of the
// organisation and returns a tenant-scoped db client. Non-members get
// NotFoundError (not Forbidden) so slugs cannot be probed.

import * as z from "zod";
import type { MembershipRole, Organization } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit, type Actor } from "./audit";
import type { PublicUser } from "./auth";
import { fieldErrors } from "./auth";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { roleCan, type Permission } from "./permissions";
import { tenantDb, type TenantDb } from "./tenant-db";

export interface OrgContext {
  user: PublicUser;
  organization: Organization;
  role: MembershipRole;
  db: TenantDb;
  actor: Actor;
}

const RESERVED_SLUGS = new Set(["admin", "api", "new", "login", "signup", "app", "settings", "destination"]);

export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 2 ? base : `org-${base}`.replace(/-+$/, "");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const taken = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new ConflictError("Could not allocate a workspace address. Try a different name.");
}

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name.").max(120),
});

/** Creates a workspace with the caller as OWNER, plus an initial business profile. */
export async function createOrganization(user: PublicUser, input: { name: string }, actor: Actor) {
  if (!user.emailVerified) {
    throw new ForbiddenError("Please confirm your email address before creating a workspace.");
  }
  const parsed = CreateOrganizationSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  const slug = await uniqueSlug(parsed.data.name);

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({ data: { name: parsed.data.name, slug } });
    await tx.membership.create({ data: { organizationId: created.id, userId: user.id, role: "OWNER" } });
    await tx.businessProfile.create({ data: { organizationId: created.id, businessName: parsed.data.name } });
    await recordAudit(
      { actor, organizationId: created.id, action: "org.created", targetType: "Organization", targetId: created.id },
      tx
    );
    return created;
  });
  return org;
}

export async function listUserOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId, organization: { status: "ACTIVE" } },
    include: { organization: { select: { id: true, slug: true, name: true, onboardingStage: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrgContext(user: PublicUser, orgSlug: string, actor: Actor): Promise<OrgContext> {
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organization: { slug: orgSlug, status: "ACTIVE" } },
    include: { organization: true },
  });
  if (!membership) throw new NotFoundError("Workspace not found.");
  return {
    user,
    organization: membership.organization,
    role: membership.role,
    db: tenantDb(membership.organizationId),
    actor,
  };
}

export function requirePermission(ctx: OrgContext, permission: Permission): void {
  if (!roleCan(ctx.role, permission)) {
    throw new ForbiddenError("Your role in this workspace does not allow this action.");
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function removeMember(ctx: OrgContext, membershipId: string) {
  requirePermission(ctx, "members.manage");
  const membership = await ctx.db.membership.findFirst({ where: { id: membershipId } });
  if (!membership) throw new NotFoundError("Member not found.");
  if (membership.role === "OWNER") {
    const owners = await ctx.db.membership.count({ where: { role: "OWNER" } });
    if (owners <= 1) throw new ConflictError("A workspace must keep at least one owner.");
  }
  await ctx.db.membership.delete({ where: { id: membership.id } });
  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "member.removed",
    targetType: "User",
    targetId: membership.userId,
  });
}

/**
 * Records a deletion request. Actual erasure runs as a reviewed back-office
 * job (see docs/platform/SECURITY.md §Customer deletion) so that provider
 * token revocation and backups are handled deliberately.
 */
export async function requestOrganizationDeletion(ctx: OrgContext) {
  requirePermission(ctx, "org.delete");
  // Stop all data access immediately; erasure itself follows review.
  await ctx.db.integrationConnection.updateMany({
    where: { status: { not: "REVOKED" } },
    data: { status: "REVOKED", credentialsCiphertext: null, scopesGranted: [], disconnectedAt: new Date() },
  });
  await ctx.db.organization.update({
    where: { id: ctx.organization.id },
    data: { status: "DELETION_REQUESTED", deletionRequestedAt: new Date() },
  });
  await recordAudit({ actor: ctx.actor, organizationId: ctx.organization.id, action: "org.deletion_requested" });
}
