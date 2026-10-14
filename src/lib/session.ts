// Compatibility adapter for the destination-intelligence modules
// (docs/ARCHITECTURE.md §6), which filter by the legacy Role enum.
//
// The original dev-only cookie role switcher has been removed: the legacy
// role is now derived from the authenticated Growth OS user (src/lib/auth).
// Programme staff map to ADMIN, operators to BUSINESS, anyone else PUBLIC.

import type { Role } from "@/generated/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export interface Session {
  role: Role;
  businessId: string | null;
  email: string | null;
}

export async function getSession(): Promise<Session> {
  const user = await getCurrentUser();
  if (!user) return { role: "PUBLIC", businessId: null, email: null };
  if (user.role === "OPERATOR") {
    return { role: "BUSINESS", businessId: user.operatorId, email: user.email };
  }
  return { role: "ADMIN", businessId: null, email: user.email };
}
