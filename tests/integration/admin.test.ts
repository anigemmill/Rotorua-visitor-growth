import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOrganizationDetail, requireStaff, setLicense } from "@/lib/platform/admin";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/platform/errors";
import { getLicenseState } from "@/lib/platform/licensing";
import { actorFor, makeCatalogue, makeOrg, makeUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function staff(role: "SUPPORT" | "SUPER_ADMIN") {
  const u = await makeUser(role);
  await prisma.user.update({ where: { id: u.id }, data: { platformRole: role } });
  const user = { ...u, platformRole: role };
  return requireStaff(user, actorFor(user));
}

describe("admin authorisation", () => {
  it("customers cannot reach staff services (404)", async () => {
    const u = await makeUser();
    expect(() => requireStaff(u, actorFor(u))).toThrow(NotFoundError);
  });
  it("support staff can view (audited) but not change licences", async () => {
    await makeCatalogue();
    const { org } = await makeOrg("Customer");
    const s = await staff("SUPPORT");
    const detail = await getOrganizationDetail(s, org.id);
    expect(detail.name).toBe("Customer");
    expect(await prisma.auditEvent.count({ where: { action: "admin.org_viewed", organizationId: org.id } })).toBe(1);
    await expect(setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE" })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });
  it("super-admins grant and update licences with an audit trail", async () => {
    await makeCatalogue();
    const { org, ctx } = await makeOrg("Customer");
    const s = await staff("SUPER_ADMIN");
    const future = new Date(Date.now() + 365 * 86400_000).toISOString();

    await setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE", currentPeriodEnd: future });
    expect((await getLicenseState(ctx.db)).access.mode).toBe("full");

    await setLicense(s, org.id, { planKey: "tourism-professional", status: "SUSPENDED" });
    expect((await getLicenseState(ctx.db)).access.mode).toBe("none");

    const actions = (await prisma.auditEvent.findMany({ where: { organizationId: org.id, action: { startsWith: "license." } } })).map(
      (e) => e.action
    );
    expect(actions.sort()).toEqual(["license.granted", "license.updated"]);
  });
  it("validates licence input", async () => {
    await makeCatalogue();
    const { org } = await makeOrg("Customer");
    const s = await staff("SUPER_ADMIN");
    await expect(setLicense(s, org.id, { planKey: "tourism-pilot", status: "TRIALING" })).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(setLicense(s, org.id, { planKey: "missing", status: "ACTIVE" })).rejects.toBeInstanceOf(ValidationError);
    await expect(setLicense(s, "nope", { planKey: "tourism-pilot", status: "ACTIVE" })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
  it("staff views never expose credential ciphertext", async () => {
    await makeCatalogue();
    const { org, ctx } = await makeOrg("Customer");
    await ctx.db.integrationConnection.create({
      data: { organizationId: org.id, providerKey: "ga4", externalAccountId: "p1", scopesGranted: [], credentialsCiphertext: "v1.secret" },
    });
    const s = await staff("SUPPORT");
    const detail = await getOrganizationDetail(s, org.id);
    expect(JSON.stringify(detail)).not.toContain("v1.secret");
  });
});

describe("AI allowance top-up", () => {
  it("staff can raise and then clear a licence's AI allowance without touching other overrides", async () => {
    await makeCatalogue();
    const { org, ctx } = await makeOrg("Customer");
    const s = await staff("SUPER_ADMIN");
    await setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE" });
    await prisma.license.updateMany({ where: { organizationId: org.id }, data: { entitlementOverrides: { limits: { brands: 9 } } } });

    await setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE", aiAllowanceUsd: "40", aiHardLimitPercent: "120" });
    let e = (await getLicenseState(ctx.db)).entitlements;
    expect(e.ai).toMatchObject({ monthlyAllowanceUsd: 40, hardLimitPercent: 120 });
    expect(e.limits.brands).toBe(9);

    await setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE" });
    e = (await getLicenseState(ctx.db)).entitlements;
    expect(e.ai?.monthlyAllowanceUsd).toBe(10); // back to the plan's allowance
    expect(e.limits.brands).toBe(9);

    await expect(
      setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE", aiAllowanceUsd: "-5" })
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      setLicense(s, org.id, { planKey: "tourism-professional", status: "ACTIVE", aiHardLimitPercent: "500" })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
