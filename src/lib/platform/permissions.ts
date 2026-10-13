// Role → permission matrix for organisation members. Pure; enforced on the
// server by requirePermission() in organizations.ts. The UI may hide
// controls a role cannot use, but hiding is never the enforcement.

import type { MembershipRole, PlatformRole } from "@/generated/prisma";

export const PERMISSIONS = [
  "org.view",
  "profile.edit",
  "brands.manage",
  "integrations.manage",
  "ecosystem.activate",
  "members.manage",
  "license.manage",
  "org.delete",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_RANK: Record<MembershipRole, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

const MIN_ROLE: Record<Permission, MembershipRole> = {
  "org.view": "VIEWER",
  "profile.edit": "ADMIN",
  "brands.manage": "ADMIN",
  "integrations.manage": "ADMIN",
  "ecosystem.activate": "ADMIN",
  "members.manage": "OWNER",
  "license.manage": "OWNER",
  "org.delete": "OWNER",
};

export function roleCan(role: MembershipRole, permission: Permission): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[MIN_ROLE[permission]];
}

export function roleAtLeast(role: MembershipRole, min: MembershipRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isPlatformStaff(role: PlatformRole): boolean {
  return role === "SUPPORT" || role === "SUPER_ADMIN";
}

export function canManagePlatform(role: PlatformRole): boolean {
  return role === "SUPER_ADMIN";
}

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
