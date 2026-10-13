import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { connectWebsite, disconnectIntegration } from "@/lib/platform/connections";
import {
  ConflictError,
  EntitlementError,
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "@/lib/platform/errors";
import { getLicenseState, startTrial } from "@/lib/platform/licensing";
import { advanceStage, createBrand, updateBusinessProfile } from "@/lib/platform/onboarding";
import { addMember, getOrgContext, removeMember } from "@/lib/platform/organizations";
import { actorFor, makeCatalogue, makeOrg, makeUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

describe("self-serve trial", () => {
  it("starts a trial on an eligible plan exactly once", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Trial Co");
    const license = await startTrial(ctx, "tourism-pilot");
    expect(license.status).toBe("TRIALING");
    expect(license.trialEndsAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
    expect((await getLicenseState(ctx.db)).access.mode).toBe("full");
    await expect(startTrial(ctx, "tourism-pilot")).rejects.toBeInstanceOf(ConflictError);
  });
  it("refuses paid plans and unknown plans", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Trial Co");
    await expect(startTrial(ctx, "tourism-professional")).rejects.toBeInstanceOf(EntitlementError);
    await expect(startTrial(ctx, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
  it("only owners can start a trial", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Trial Co");
    const admin = await makeUser("Admin");
    // No licence yet, so add the membership directly rather than via addMember (which applies plan limits).
    await prisma.membership.create({ data: { organizationId: ctx.organization.id, userId: admin.id, role: "ADMIN" } });
    const adminCtx = await getOrgContext(admin, ctx.organization.slug, actorFor(admin));
    await expect(startTrial(adminCtx, "tourism-pilot")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("licence gates", () => {
  it("no licence: cannot connect integrations; one brand allowed", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("No Licence");
    await expect(connectWebsite(ctx, { domain: "example.com" })).rejects.toBeInstanceOf(EntitlementError);
    await createBrand(ctx, { name: "First" });
    await expect(createBrand(ctx, { name: "Second" })).rejects.toBeInstanceOf(LimitExceededError);
  });
  it("expired trial is read-only: integrations blocked", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Expired");
    const l = await startTrial(ctx, "tourism-pilot");
    await prisma.license.update({ where: { id: l.id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
    expect((await getLicenseState(ctx.db)).access.mode).toBe("read_only");
    await expect(connectWebsite(ctx, { domain: "example.com" })).rejects.toBeInstanceOf(EntitlementError);
  });
  it("suspended licence grants no entitlements", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Suspended");
    const l = await startTrial(ctx, "tourism-pilot");
    await prisma.license.update({ where: { id: l.id }, data: { status: "SUSPENDED" } });
    const s = await getLicenseState(ctx.db);
    expect(s.access.mode).toBe("none");
    expect(s.entitlements.features).toEqual({});
  });
  it("features missing from the plan are refused", async () => {
    const { trialPlan } = await makeCatalogue();
    await prisma.plan.update({ where: { id: trialPlan.id }, data: { entitlements: { features: {}, limits: { integrations: 5 } } } });
    const { ctx } = await makeOrg("No Website Feature");
    await startTrial(ctx, "tourism-pilot");
    await expect(connectWebsite(ctx, { domain: "example.com" })).rejects.toThrow(/not included in your plan/);
  });
});

describe("plan limits", () => {
  it("enforces brand, integration and user limits; disconnecting frees a slot", async () => {
    await makeCatalogue(); // brands 2, users 3, integrations 2
    const { ctx } = await makeOrg("Limits Co");
    await startTrial(ctx, "tourism-pilot");

    await createBrand(ctx, { name: "A" });
    await createBrand(ctx, { name: "B" });
    await expect(createBrand(ctx, { name: "C" })).rejects.toBeInstanceOf(LimitExceededError);

    const c1 = await connectWebsite(ctx, { domain: "one.example.com" });
    await connectWebsite(ctx, { domain: "two.example.com" });
    await expect(connectWebsite(ctx, { domain: "three.example.com" })).rejects.toBeInstanceOf(LimitExceededError);
    // Re-adding an existing domain is idempotent, not a new slot.
    expect((await connectWebsite(ctx, { domain: "https://one.example.com/x" })).id).toBe(c1.id);
    await disconnectIntegration(ctx, c1.id);
    const c3 = await connectWebsite(ctx, { domain: "three.example.com" });
    expect(c3.status).toBe("PENDING");
    // Reconnecting a revoked domain reuses its row.
    await disconnectIntegration(ctx, c3.id);
    const again = await connectWebsite(ctx, { domain: "one.example.com" });
    expect(again.id).toBe(c1.id);

    const u1 = await makeUser("U1");
    const u2 = await makeUser("U2");
    const u3 = await makeUser("U3");
    await addMember(ctx, { email: u1.email, role: "MEMBER" });
    const m2 = await addMember(ctx, { email: u2.email, role: "VIEWER" });
    await expect(addMember(ctx, { email: u3.email, role: "VIEWER" })).rejects.toBeInstanceOf(LimitExceededError);
    await removeMember(ctx, m2.id);
    await addMember(ctx, { email: u3.email, role: "VIEWER" });
  });
});

describe("roles", () => {
  it("viewers cannot edit, and the last owner cannot be removed", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Roles Co");
    await startTrial(ctx, "tourism-pilot");
    const viewer = await makeUser("Viewer");
    await addMember(ctx, { email: viewer.email, role: "VIEWER" });
    const vctx = await getOrgContext(viewer, ctx.organization.slug, actorFor(viewer));

    await expect(updateBusinessProfile(vctx, { businessName: "Hacked" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createBrand(vctx, { name: "X" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(connectWebsite(vctx, { domain: "x.example.com" })).rejects.toBeInstanceOf(ForbiddenError);

    const ownerMembership = await ctx.db.membership.findFirstOrThrow({ where: { role: "OWNER" } });
    await expect(removeMember(ctx, ownerMembership.id)).rejects.toBeInstanceOf(ConflictError);
  });
  it("validates profile input", async () => {
    await makeCatalogue();
    const { ctx } = await makeOrg("Valid Co");
    await expect(updateBusinessProfile(ctx, { businessName: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateBusinessProfile(ctx, { businessName: "X", website: "javascript:alert(1)" })).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(updateBusinessProfile(ctx, { businessName: "X", timeZone: "Mars/Olympus" })).rejects.toBeInstanceOf(
      ValidationError
    );
    await updateBusinessProfile(ctx, { businessName: "X", timeZone: "Pacific/Auckland", website: "https://x.co.nz" });
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization.id } });
    expect(org.onboardingStage).toBe("BUSINESS_KNOWLEDGE");
    // Stages never move backwards.
    await advanceStage(ctx, "BUSINESS_PROFILE");
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization.id } })).onboardingStage).toBe(
      "BUSINESS_KNOWLEDGE"
    );
  });
});
