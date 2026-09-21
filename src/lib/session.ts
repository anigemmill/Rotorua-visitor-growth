// Session/role shape for access-level filtering (docs/ARCHITECTURE.md §6).
//
// TODO(auth): this is a development-only stand-in. It reads a role from an
// unsigned cookie so the rest of the app (and this session's manual
// testing) has something real to filter against, but it performs no
// authentication whatsoever. Replace with NextAuth/Clerk/SSO before any
// real deployment — nothing here should be mistaken for production auth.

import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma";

export interface Session {
  role: Role;
  businessId: string | null; // set only for BUSINESS role sessions
  email: string | null;
}

export const DEV_ROLE_COOKIE = "dev-role";

export async function getSession(): Promise<Session> {
  const store = await cookies();
  const roleCookie = store.get(DEV_ROLE_COOKIE)?.value;
  const role: Role =
    roleCookie === "ADMIN" || roleCookie === "PARTNER" || roleCookie === "BUSINESS"
      ? roleCookie
      : "PUBLIC";

  return {
    role,
    businessId: role === "BUSINESS" ? "dev-business" : null,
    email: role === "PUBLIC" ? null : `${role.toLowerCase()}@dev.local`,
  };
}
