import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  checkPasswordResetRequest,
  createInvitation,
  listPendingInvitations,
  previewInvitation,
  resetPassword,
  revokeInvitation,
  sendPasswordReset,
  sendVerificationEmail,
  TOKEN_TTL_MS,
  verifyEmail,
} from "@/lib/platform/account";
import { authenticate, createSession, validateSessionToken } from "@/lib/platform/auth";
import { memoryOutbox } from "@/lib/platform/email";
import { ConflictError, EntitlementError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "@/lib/platform/errors";
import { startTrial } from "@/lib/platform/licensing";
import { createOrganization, getOrgContext } from "@/lib/platform/organizations";
import { actorFor, inviteAndAccept, lastEmail, makeCatalogue, makeOrg, makeUser, meta, resetDb, tokenFrom } from "../helpers/db";

beforeEach(resetDb);

const PW = "correct horse battery";

describe("email verification", () => {
  it("new accounts must verify before creating a workspace or starting a trial", async () => {
    await makeCatalogue();
    const user = await makeUser("New", { verified: false });
    expect(user.emailVerified).toBe(false);
    await expect(createOrganization(user, { name: "Blocked Co" }, actorFor(user))).rejects.toBeInstanceOf(ForbiddenError);

    await sendVerificationEmail(user);
    const msg = lastEmail(user.email, "verify_email");
    expect(msg.text).toContain("http://localhost:3000/auth/verify-email?token=");
    const verified = await verifyEmail(tokenFrom(msg), meta);
    expect(verified.emailVerified).toBe(true);
    await expect(createOrganization(verified, { name: "Allowed Co" }, actorFor(verified))).resolves.toBeTruthy();
  });

  it("links are single-use, expire, and are replaced by newer links", async () => {
    const user = await makeUser("U", { verified: false });
    const t0 = new Date("2026-10-14T00:00:00Z");
    await sendVerificationEmail(user, t0);
    const first = tokenFrom(lastEmail(user.email));
    await sendVerificationEmail(user, t0);
    const second = tokenFrom(lastEmail(user.email));
    await expect(verifyEmail(first, meta, t0)).rejects.toBeInstanceOf(ValidationError); // voided by the reissue
    await expect(verifyEmail(second, meta, new Date(t0.getTime() + TOKEN_TTL_MS.EMAIL_VERIFICATION + 1))).rejects.toBeInstanceOf(ValidationError);
    await sendVerificationEmail(user, t0);
    const third = tokenFrom(lastEmail(user.email));
    await verifyEmail(third, meta, t0);
    await expect(verifyEmail(third, meta, t0)).rejects.toBeInstanceOf(ValidationError);
    await expect(verifyEmail("garbage", meta)).rejects.toBeInstanceOf(ValidationError);
  });

  it("a link sent to an old address stops working if the email changes", async () => {
    const user = await makeUser("U", { verified: false });
    await sendVerificationEmail(user);
    const token = tokenFrom(lastEmail(user.email));
    await prisma.user.update({ where: { id: user.id }, data: { email: "changed@example.com" } });
    await expect(verifyEmail(token, meta)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rate-limits resends", async () => {
    const user = await makeUser("U", { verified: false });
    for (let i = 0; i < 5; i++) await sendVerificationEmail(user);
    await expect(sendVerificationEmail(user)).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("password reset", () => {
  it("resets the password, signs out every session and notifies the user", async () => {
    const user = await makeUser("U");
    const { token: sessionToken } = await createSession(user.id, meta);
    const email = await checkPasswordResetRequest(` ${user.email.toUpperCase()} `, meta);
    expect(email).toBe(user.email);
    await sendPasswordReset(email, meta);
    const token = tokenFrom(lastEmail(user.email, "password_reset"));

    // A weak password is rejected without burning the link.
    await expect(resetPassword({ token, password: "short" }, meta)).rejects.toBeInstanceOf(ValidationError);
    await resetPassword({ token, password: "a brand new passphrase" }, meta);

    expect(await validateSessionToken(sessionToken)).toBeNull();
    await expect(authenticate({ email: user.email, password: PW }, { ...meta, ipAddress: null })).rejects.toThrow();
    await expect(authenticate({ email: user.email, password: "a brand new passphrase" }, { ...meta, ipAddress: null })).resolves.toBeTruthy();
    expect(lastEmail(user.email, "password_changed")).toBeTruthy();
    await expect(resetPassword({ token, password: "another new passphrase" }, meta)).rejects.toBeInstanceOf(ValidationError);
  });

  it("sends nothing for unknown addresses and gives the caller no signal", async () => {
    const email = await checkPasswordResetRequest("nobody@example.com", meta);
    await expect(sendPasswordReset(email, meta)).resolves.toBeUndefined();
    expect(memoryOutbox).toHaveLength(0);
  });

  it("expires after 30 minutes and cannot use a verification token", async () => {
    const user = await makeUser("U", { verified: false });
    const t0 = new Date("2026-10-14T00:00:00Z");
    await sendPasswordReset(user.email, meta, t0);
    const resetToken = tokenFrom(lastEmail(user.email, "password_reset"));
    await expect(
      resetPassword({ token: resetToken, password: "a brand new passphrase" }, meta, new Date(t0.getTime() + 31 * 60 * 1000))
    ).rejects.toBeInstanceOf(ValidationError);
    await sendVerificationEmail(user, t0);
    const verifyToken = tokenFrom(lastEmail(user.email, "verify_email"));
    await expect(resetPassword({ token: verifyToken, password: "a brand new passphrase" }, meta, t0)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rate-limits requests per address", async () => {
    for (let i = 0; i < 5; i++) await checkPasswordResetRequest("target@example.com", { ...meta, ipAddress: null });
    await expect(checkPasswordResetRequest("target@example.com", { ...meta, ipAddress: null })).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("invitations", () => {
  async function licensed() {
    await makeCatalogue();
    const owner = await makeOrg("Invite Co");
    await startTrial(owner.ctx, "tourism-pilot");
    return owner;
  }

  it("an invited person without an account signs up, accepts and is verified by the link", async () => {
    const { ctx } = await licensed();
    await createInvitation(ctx, { email: "New.Person@Example.com", role: "ADMIN" });
    const msg = lastEmail("new.person@example.com", "invitation");
    const token = tokenFrom(msg);
    expect(await previewInvitation(token)).toMatchObject({ valid: true, organizationName: "Invite Co", role: "ADMIN" });

    const { signUp } = await import("@/lib/platform/auth");
    const invitee = await signUp({ name: "New Person", email: "new.person@example.com", password: PW }, { ...meta, ipAddress: null });
    const slug = await acceptInvitation(invitee, token, actorFor(invitee));
    expect(slug).toBe(ctx.organization.slug);
    const member = await getOrgContext(invitee, slug, actorFor(invitee));
    expect(member.role).toBe("ADMIN");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: invitee.id } })).emailVerifiedAt).not.toBeNull();
    await expect(acceptInvitation(invitee, token, actorFor(invitee))).rejects.toBeInstanceOf(ValidationError);
    expect(await previewInvitation(token)).toMatchObject({ valid: false });
  });

  it("only the invited address can accept", async () => {
    const { ctx } = await licensed();
    const intended = await makeUser("Intended");
    const other = await makeUser("Other");
    await createInvitation(ctx, { email: intended.email, role: "VIEWER" });
    const token = tokenFrom(lastEmail(intended.email));
    await expect(acceptInvitation(other, token, actorFor(other))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getOrgContext(other, ctx.organization.slug, actorFor(other))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("revoked, replaced and expired invitations cannot be used", async () => {
    const { ctx } = await licensed();
    const u = await makeUser("U");
    const t0 = new Date();
    await createInvitation(ctx, { email: u.email, role: "VIEWER" }, t0);
    const first = tokenFrom(lastEmail(u.email));
    await createInvitation(ctx, { email: u.email, role: "MEMBER" }, t0); // replaces the first
    const second = tokenFrom(lastEmail(u.email));
    await expect(acceptInvitation(u, first, actorFor(u))).rejects.toBeInstanceOf(ValidationError);
    expect(await listPendingInvitations(ctx)).toHaveLength(1);

    const [pending] = await listPendingInvitations(ctx);
    await revokeInvitation(ctx, pending.id);
    await expect(acceptInvitation(u, second, actorFor(u))).rejects.toBeInstanceOf(ValidationError);

    await createInvitation(ctx, { email: u.email, role: "VIEWER" }, t0);
    const third = tokenFrom(lastEmail(u.email));
    await expect(
      acceptInvitation(u, third, actorFor(u), new Date(t0.getTime() + TOKEN_TTL_MS.INVITATION + 1))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("pending invitations count towards the user limit, and existing members can't be re-invited", async () => {
    const { ctx } = await licensed(); // test plan: 3 users
    const a = await makeUser("A");
    await inviteAndAccept(ctx, a, "VIEWER");
    await createInvitation(ctx, { email: "pending@example.com", role: "VIEWER" });
    await expect(createInvitation(ctx, { email: "one-too-many@example.com", role: "VIEWER" })).rejects.toThrow(/allows up to 3/);
    await expect(createInvitation(ctx, { email: a.email, role: "ADMIN" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("requires an owner with a verified email and a licence", async () => {
    await makeCatalogue();
    const { ctx, user } = await makeOrg("No Licence Co");
    await expect(createInvitation(ctx, { email: "x@example.com", role: "VIEWER" })).rejects.toBeInstanceOf(EntitlementError);
    await startTrial(ctx, "tourism-pilot");

    const admin = await makeUser("Admin");
    await inviteAndAccept(ctx, admin, "ADMIN");
    const adminCtx = await getOrgContext(admin, ctx.organization.slug, actorFor(admin));
    await expect(createInvitation(adminCtx, { email: "x@example.com", role: "VIEWER" })).rejects.toBeInstanceOf(ForbiddenError);

    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: null } });
    const unverifiedOwner = await getOrgContext({ ...user, emailVerified: false }, ctx.organization.slug, actorFor(user));
    await expect(createInvitation(unverifiedOwner, { email: "x@example.com", role: "VIEWER" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cannot revoke another workspace's invitation", async () => {
    const { ctx } = await licensed();
    const other = await makeOrg("Other Co");
    await startTrial(other.ctx, "tourism-pilot");
    await createInvitation(other.ctx, { email: "z@example.com", role: "VIEWER" });
    const [theirs] = await listPendingInvitations(other.ctx);
    await expect(revokeInvitation(ctx, theirs.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listPendingInvitations(other.ctx)).toHaveLength(1);
  });

  it("rejects malformed input", async () => {
    const { ctx } = await licensed();
    await expect(createInvitation(ctx, { email: "not-an-email", role: "VIEWER" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createInvitation(ctx, { email: "a@example.com", role: "OWNER" as "VIEWER" })).rejects.toBeInstanceOf(ValidationError);
  });
});
