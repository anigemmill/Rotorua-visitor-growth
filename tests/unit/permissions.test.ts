import { describe, expect, it } from "vitest";
import { canManagePlatform, isPlatformStaff, PERMISSIONS, roleCan } from "@/lib/platform/permissions";

describe("role permissions", () => {
  it("owners can do everything", () => {
    for (const p of PERMISSIONS) expect(roleCan("OWNER", p)).toBe(true);
  });
  it("viewers can only view", () => {
    for (const p of PERMISSIONS) expect(roleCan("VIEWER", p)).toBe(p === "org.view");
  });
  it("admins cannot manage members, licences or delete the workspace", () => {
    expect(roleCan("ADMIN", "integrations.manage")).toBe(true);
    expect(roleCan("ADMIN", "members.manage")).toBe(false);
    expect(roleCan("ADMIN", "license.manage")).toBe(false);
    expect(roleCan("ADMIN", "org.delete")).toBe(false);
  });
  it("members cannot change configuration", () => {
    expect(roleCan("MEMBER", "profile.edit")).toBe(false);
    expect(roleCan("MEMBER", "integrations.manage")).toBe(false);
  });
  it("platform roles", () => {
    expect(isPlatformStaff("NONE")).toBe(false);
    expect(isPlatformStaff("SUPPORT")).toBe(true);
    expect(canManagePlatform("SUPPORT")).toBe(false);
    expect(canManagePlatform("SUPER_ADMIN")).toBe(true);
  });
});
