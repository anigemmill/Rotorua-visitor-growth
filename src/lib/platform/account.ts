// Account security flows: email verification, password reset and workspace
// invitations.
//
// Shared rules for every emailed link:
//   - 256-bit random token; only its SHA-256 is stored.
//   - Single use (marked used atomically) and short-lived.
//   - Issuing a new token of the same kind voids older unused ones.
//   - Tokens are bound to the email address they were sent to.
//   - Requests are rate-limited; responses never reveal whether an email
//     address has an account.

import * as z from "zod";
import type { MembershipRole, UserTokenPurpose } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit, type Actor } from "./audit";
import { EmailSchema, fieldErrors, revokeAllSessions, toPublicUser, type PublicUser, type RequestMeta } from "./auth";
import {
  appUrl,
  invitationEmail,
  passwordChangedEmail,
  passwordResetEmail,
  sendEmail,
  verificationEmail,
} from "./email";
import { withinLimit } from "./entitlements";
import { ConflictError, EntitlementError, ForbiddenError, LimitExceededError, NotFoundError, ValidationError } from "./errors";
import { getLicenseState, LIMIT_LABELS } from "./licensing";
import { requirePermission, type OrgContext } from "./organizations";
import { hashPassword, PASSWORD_MIN_LENGTH } from "./passwords";
import { MEMBERSHIP_ROLE_LABELS } from "./permissions";
import { consumeRateLimit } from "./rate-limit";
import { generateToken, hashToken } from "./tokens";

const HOUR = 60 * 60 * 1000;
export const TOKEN_TTL_MS: Record<UserTokenPurpose | "INVITATION", number> = {
  EMAIL_VERIFICATION: 24 * HOUR,
  PASSWORD_RESET: 30 * 60 * 1000,
  INVITATION: 7 * 24 * HOUR,
};

export const ACCOUNT_RATE_LIMITS = {
  verificationPerUser: { limit: 5, windowSeconds: 60 * 60 },
  resetPerEmail: { limit: 5, windowSeconds: 60 * 60 },
  resetPerIp: { limit: 20, windowSeconds: 60 * 60 },
  invitationsPerOrg: { limit: 30, windowSeconds: 24 * 60 * 60 },
};

const INVALID_LINK = "This link is invalid or has expired. Request a new one.";

const emailSchema = EmailSchema;
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(256, "Password is too long.");

// ---------------------------------------------------------------------------
// Single-use user tokens
// ---------------------------------------------------------------------------

async function issueUserToken(userId: string, email: string, purpose: UserTokenPurpose, now: Date): Promise<string> {
  const token = generateToken();
  await prisma.$transaction([
    prisma.userToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
    prisma.userToken.create({
      data: { userId, email, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]) },
    }),
  ]);
  return token;
}

/** Atomically consumes a token; returns its user, or throws ValidationError for anything invalid. */
async function consumeUserToken(token: string, purpose: UserTokenPurpose, now: Date) {
  if (!token || token.length > 128) throw new ValidationError(INVALID_LINK);
  const row = await prisma.userToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now || row.user.disabledAt || row.user.email !== row.email) {
    throw new ValidationError(INVALID_LINK);
  }
  // updateMany with usedAt: null makes concurrent double-use impossible.
  const claimed = await prisma.userToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new ValidationError(INVALID_LINK);
  return row.user;
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(user: PublicUser, now: Date = new Date()): Promise<void> {
  if (user.emailVerified) return;
  await consumeRateLimit(`verify:user:${user.id}`, ACCOUNT_RATE_LIMITS.verificationPerUser, now);
  const token = await issueUserToken(user.id, user.email, "EMAIL_VERIFICATION", now);
  await sendEmail(verificationEmail(user.email, user.name, appUrl(`/auth/verify-email?token=${encodeURIComponent(token)}`)));
}

export async function verifyEmail(token: string, meta: RequestMeta, now: Date = new Date()): Promise<PublicUser> {
  const user = await consumeUserToken(token, "EMAIL_VERIFICATION", now);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: user.emailVerifiedAt ?? now },
  });
  await recordAudit({ actor: { userId: user.id, email: user.email, ipAddress: meta.ipAddress }, action: "auth.email_verified" });
  return toPublicUser(updated);
}

export function requireVerifiedEmail(user: PublicUser): void {
  if (!user.emailVerified) throw new ForbiddenError("Please confirm your email address first. Check your inbox for the link.");
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Validates the address and applies rate limits synchronously (so the caller
 * can show a "too many attempts" error), returning the normalised email.
 * The actual send — which only happens if an account exists — should run
 * after the response (Next's after()) so response timing doesn't reveal
 * whether the address is registered.
 */
export async function checkPasswordResetRequest(rawEmail: string, meta: RequestMeta, now: Date = new Date()): Promise<string> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new ValidationError("Enter a valid email address.", { email: ["Enter a valid email address."] });
  await consumeRateLimit(`reset:email:${parsed.data}`, ACCOUNT_RATE_LIMITS.resetPerEmail, now);
  if (meta.ipAddress) await consumeRateLimit(`reset:ip:${meta.ipAddress}`, ACCOUNT_RATE_LIMITS.resetPerIp, now);
  return parsed.data;
}

export async function sendPasswordReset(email: string, meta: RequestMeta, now: Date = new Date()): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.disabledAt) return;
  const token = await issueUserToken(user.id, user.email, "PASSWORD_RESET", now);
  await sendEmail(passwordResetEmail(user.email, appUrl(`/reset-password?token=${encodeURIComponent(token)}`)));
  await recordAudit({ actor: { userId: user.id, email: user.email, ipAddress: meta.ipAddress }, action: "auth.password_reset_requested" });
}

export async function resetPassword(
  input: { token: string; password: string },
  meta: RequestMeta,
  now: Date = new Date()
): Promise<void> {
  const pw = passwordSchema.safeParse(input.password);
  if (!pw.success) throw new ValidationError("Please check the highlighted fields.", { password: pw.error.issues.map((i) => i.message) });
  const user = await consumeUserToken(input.token, "PASSWORD_RESET", now);
  await prisma.user.update({
    where: { id: user.id },
    // Receiving the link proves control of the address.
    data: { passwordHash: await hashPassword(pw.data), emailVerifiedAt: user.emailVerifiedAt ?? now },
  });
  await revokeAllSessions(user.id);
  await recordAudit({ actor: { userId: user.id, email: user.email, ipAddress: meta.ipAddress }, action: "auth.password_reset" });
  await sendEmail(passwordChangedEmail(user.email));
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const InvitationSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

function pendingWhere(now: Date) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

async function seatsInUse(ctx: OrgContext, now: Date): Promise<number> {
  const [members, pending] = await Promise.all([
    ctx.db.membership.count(),
    ctx.db.invitation.count({ where: pendingWhere(now) }),
  ]);
  return members + pending;
}

export async function listPendingInvitations(ctx: OrgContext, now: Date = new Date()) {
  return ctx.db.invitation.findMany({
    where: pendingWhere(now),
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInvitation(ctx: OrgContext, input: z.input<typeof InvitationSchema>, now: Date = new Date()) {
  requirePermission(ctx, "members.manage");
  requireVerifiedEmail(ctx.user);
  const parsed = InvitationSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  const { email, role } = parsed.data;

  const license = await getLicenseState(ctx.db, undefined, now);
  if (!license.license) throw new EntitlementError("Start a plan before inviting your team.");

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser && (await ctx.db.membership.count({ where: { userId: existingUser.id } }))) {
    throw new ConflictError("That person is already a member of this workspace.");
  }
  // Re-inviting the same address replaces the earlier invitation.
  await ctx.db.invitation.updateMany({ where: { email, ...pendingWhere(now) }, data: { revokedAt: now } });
  if (!withinLimit(license.entitlements, "users", await seatsInUse(ctx, now))) {
    throw new LimitExceededError(LIMIT_LABELS.users, license.entitlements.limits.users ?? 0);
  }
  await consumeRateLimit(`invite:org:${ctx.organization.id}`, ACCOUNT_RATE_LIMITS.invitationsPerOrg, now);

  const token = generateToken();
  const invitation = await ctx.db.invitation.create({
    data: {
      organizationId: ctx.organization.id,
      email,
      role,
      tokenHash: hashToken(token),
      invitedById: ctx.user.id,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS.INVITATION),
    },
  });
  await sendEmail(
    invitationEmail(email, ctx.user.name, ctx.organization.name, MEMBERSHIP_ROLE_LABELS[role], appUrl(`/invite?token=${encodeURIComponent(token)}`))
  );
  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "member.invited",
    targetType: "Invitation",
    targetId: invitation.id,
    metadata: { role },
  });
  return { id: invitation.id, email, role };
}

export async function revokeInvitation(ctx: OrgContext, invitationId: string, now: Date = new Date()) {
  requirePermission(ctx, "members.manage");
  const res = await ctx.db.invitation.updateMany({ where: { id: invitationId, ...pendingWhere(now) }, data: { revokedAt: now } });
  if (res.count !== 1) throw new NotFoundError("Invitation not found.");
  await recordAudit({ actor: ctx.actor, organizationId: ctx.organization.id, action: "member.invitation_revoked", targetType: "Invitation", targetId: invitationId });
}

export type InvitationPreview =
  | { valid: true; organizationName: string; email: string; role: MembershipRole }
  | { valid: false; reason: string };

/** What the invite page shows. Reveals details only to whoever holds the token. */
export async function previewInvitation(token: string, now: Date = new Date()): Promise<InvitationPreview> {
  if (!token || token.length > 128) return { valid: false, reason: INVALID_LINK };
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { name: true, status: true } } },
  });
  if (!inv || inv.revokedAt || inv.expiresAt <= now || inv.organization.status !== "ACTIVE") {
    return { valid: false, reason: "This invitation is invalid, has expired or has been withdrawn. Ask for a new one." };
  }
  if (inv.acceptedAt) return { valid: false, reason: "This invitation has already been accepted." };
  return { valid: true, organizationName: inv.organization.name, email: inv.email, role: inv.role };
}

/** Accepts an invitation as the signed-in user. Returns the workspace slug. */
export async function acceptInvitation(user: PublicUser, token: string, actor: Actor, now: Date = new Date()): Promise<string> {
  if (!token || token.length > 128) throw new ValidationError(INVALID_LINK);
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: true },
  });
  if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt <= now || inv.organization.status !== "ACTIVE") {
    throw new ValidationError("This invitation is invalid, has expired or has been withdrawn.");
  }
  if (inv.email !== user.email) {
    throw new ForbiddenError(`This invitation was sent to a different email address. Sign in as that address to accept it.`);
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    if (claimed.count !== 1) throw new ValidationError("This invitation has already been used.");
    const existing = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId: inv.organizationId, userId: user.id } },
    });
    if (!existing) {
      await tx.membership.create({ data: { organizationId: inv.organizationId, userId: user.id, role: inv.role } });
    }
    // Following the emailed link proves control of the address.
    if (!user.emailVerified) await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
    await recordAudit(
      { actor, organizationId: inv.organizationId, action: "member.invitation_accepted", targetType: "Invitation", targetId: inv.id, metadata: { role: inv.role } },
      tx
    );
  });
  return inv.organization.slug;
}
