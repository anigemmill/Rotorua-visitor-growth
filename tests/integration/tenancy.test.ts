import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { connectWebsite, disconnectIntegration, getConnectionCentre } from "@/lib/platform/connections";
import { NotFoundError } from "@/lib/platform/errors";
import { startTrial } from "@/lib/platform/licensing";
import { createBrand, deleteBrand, getProfile, listBrands, updateBusinessProfile } from "@/lib/platform/onboarding";
import { getOrgContext } from "@/lib/platform/organizations";
import { TenantIsolationError, tenantDb } from "@/lib/platform/tenant-db";
import { actorFor, makeCatalogue, makeOrg, makeUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function twoTenants() {
  await makeCatalogue();
  const a = await makeOrg("Alpha Tours");
  const b = await makeOrg("Beta Adventures");
  await startTrial(a.ctx, "tourism-pilot");
  await startTrial(b.ctx, "tourism-pilot");
  return { a, b };
}

describe("tenant isolation", () => {
  it("non-members cannot open another workspace (404, not 403)", async () => {
    const { a, b } = await twoTenants();
    await expect(getOrgContext(a.user, b.org.slug, actorFor(a.user))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("each tenant only ever sees its own rows", async () => {
    const { a, b } = await twoTenants();
    await createBrand(a.ctx, { name: "Alpha Brand" });
    await createBrand(b.ctx, { name: "Beta Brand" });
    await connectWebsite(a.ctx, { domain: "alpha.example.com" });
    await connectWebsite(b.ctx, { domain: "beta.example.com" });

    expect((await listBrands(a.ctx)).map((x) => x.name)).toEqual(["Alpha Brand"]);
    expect((await listBrands(b.ctx)).map((x) => x.name)).toEqual(["Beta Brand"]);
    expect((await getProfile(a.ctx))?.businessName).toBe("Alpha Tours");

    const centre = await getConnectionCentre(a.ctx);
    const domains = centre.flatMap((e) => e.connections.map((c) => c.externalAccountId));
    expect(domains).toEqual(["alpha.example.com"]);
  });

  it("cannot mutate another tenant's rows by id", async () => {
    const { a, b } = await twoTenants();
    const bBrand = await createBrand(b.ctx, { name: "Beta Brand" });
    const bConn = await connectWebsite(b.ctx, { domain: "beta.example.com" });

    await expect(deleteBrand(a.ctx, bBrand.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(disconnectIntegration(a.ctx, bConn.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.brand.count({ where: { id: bBrand.id } })).toBe(1);
    expect((await prisma.integrationConnection.findUniqueOrThrow({ where: { id: bConn.id } })).status).toBe("PENDING");
  });

  it("the tenant client blocks direct cross-tenant access even when a service forgets a filter", async () => {
    const { a, b } = await twoTenants();
    const bBrand = await createBrand(b.ctx, { name: "Beta Brand" });
    const db = tenantDb(a.org.id);

    expect(await db.brand.findUnique({ where: { id: bBrand.id } })).toBeNull();
    expect(await db.brand.findMany()).toEqual([]);
    await expect(db.brand.update({ where: { id: bBrand.id }, data: { name: "pwned" } })).rejects.toThrow();
    expect((await db.brand.deleteMany({ where: { id: bBrand.id } })).count).toBe(0);
    await expect(db.brand.create({ data: { name: "x", organizationId: b.org.id } })).rejects.toBeInstanceOf(
      TenantIsolationError
    );
    expect(await db.organization.findFirst({ where: { slug: b.org.slug } })).toBeNull();
    // Interactive transactions keep the scope.
    const inTx = await db.$transaction(async (tx) => tx.brand.findMany());
    expect(inTx).toEqual([]);
  });

  it("profile updates only touch the caller's tenant", async () => {
    const { a, b } = await twoTenants();
    await updateBusinessProfile(a.ctx, { businessName: "Alpha Renamed", competitors: "X\nY, Z" });
    expect((await getProfile(a.ctx))?.competitors).toEqual(["X", "Y", "Z"]);
    expect((await getProfile(b.ctx))?.businessName).toBe("Beta Adventures");
  });

  it("a user in two workspaces gets a separate context for each", async () => {
    await makeCatalogue();
    const user = await makeUser("Multi");
    const one = await makeOrg("One Org", user);
    const two = await makeOrg("Two Org", user);
    await createBrand(one.ctx, { name: "Only In One" });
    expect(await listBrands(two.ctx)).toEqual([]);
  });
});
