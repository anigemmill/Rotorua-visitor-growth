import { describe, expect, it } from "vitest";
import { normaliseDomain } from "@/lib/platform/connections";
import { scopeArgs, TenantIsolationError } from "@/lib/platform/tenant-db";

describe("scopeArgs", () => {
  it("adds organizationId to reads on tenant models", () => {
    expect(scopeArgs("Brand", "findMany", { where: { name: "x" } }, "org1")).toEqual({
      where: { name: "x", organizationId: "org1" },
    });
    expect(scopeArgs("Brand", "count", undefined, "org1")).toEqual({ where: { organizationId: "org1" } });
  });
  it("stamps creates, including createMany arrays", () => {
    expect(scopeArgs("Brand", "create", { data: { name: "x" } }, "org1")).toEqual({
      data: { name: "x", organizationId: "org1" },
    });
    expect(scopeArgs("Brand", "createMany", { data: [{ name: "a" }, { name: "b" }] }, "org1")).toEqual({
      data: [
        { name: "a", organizationId: "org1" },
        { name: "b", organizationId: "org1" },
      ],
    });
  });
  it("throws when a query names another organisation", () => {
    expect(() => scopeArgs("Brand", "findMany", { where: { organizationId: "org2" } }, "org1")).toThrow(
      TenantIsolationError
    );
    expect(() => scopeArgs("Brand", "create", { data: { organizationId: "org2" } }, "org1")).toThrow(
      TenantIsolationError
    );
    expect(() =>
      scopeArgs("Brand", "update", { where: { id: "b" }, data: { organizationId: "org2" } }, "org1")
    ).toThrow(TenantIsolationError);
    expect(() =>
      scopeArgs("Brand", "create", { data: { organization: { connect: { id: "org2" } } } }, "org1")
    ).toThrow(TenantIsolationError);
    expect(() =>
      scopeArgs("Brand", "findMany", { where: { organizationId: { in: ["org1", "org2"] } } }, "org1")
    ).toThrow(TenantIsolationError);
  });
  it("scopes the Organization model by id and forbids creating organisations", () => {
    expect(scopeArgs("Organization", "findFirst", {}, "org1")).toEqual({ where: { id: "org1" } });
    expect(() => scopeArgs("Organization", "create", { data: {} }, "org1")).toThrow(TenantIsolationError);
  });
  it("scopes upserts on both branches", () => {
    expect(
      scopeArgs("BusinessProfile", "upsert", { where: { organizationId: "org1" }, create: { a: 1 }, update: { a: 2 } }, "org1")
    ).toEqual({ where: { organizationId: "org1" }, create: { a: 1, organizationId: "org1" }, update: { a: 2 } });
  });
  it("leaves global models untouched", () => {
    const args = { where: { key: "x" } };
    expect(scopeArgs("Plan", "findUnique", args, "org1")).toBe(args);
  });
});

describe("normaliseDomain", () => {
  it("accepts and normalises public domains", () => {
    expect(normaliseDomain("https://www.Example.co.nz/about?x=1")).toBe("www.example.co.nz");
    expect(normaliseDomain("example.com.")).toBe("example.com");
  });
  it.each(["", "localhost", "http://127.0.0.1", "10.0.0.5", "[::1]", "intranet", "foo.local", "a b.com", "svc.internal"])(
    "rejects %j",
    (input) => {
      expect(() => normaliseDomain(input)).toThrow();
    }
  );
});
