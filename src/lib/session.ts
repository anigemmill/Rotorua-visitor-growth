// Session/role shape for the legacy Destination Command Centre's access-
// level filtering (docs/ARCHITECTURE.md §6).
//
// The original development-only role cookie has been removed: it let anyone
// claim ADMIN. The destination dashboard is now a platform-staff tool, so its
// legacy role is derived from real authentication — platform staff map to
// ADMIN, everyone else (including signed-out visitors) to PUBLIC, which the
// legacy API routes already reject for every write.

import type { Role } from "@/generated/prisma";
import { isPlatformStaff } from "@/lib/platform/permissions";
import { getCurrentUser } from "@/lib/web/session";

export interface Session {
  role: Role;
  businessId: string | null; // set only for BUSINESS role sessions
  email: string | null;
}

export async function getSession(): Promise<Session> {
  const user = await getCurrentUser();
  if (user && isPlatformStaff(user.platformRole)) {
    return { role: "ADMIN", businessId: null, email: user.email };
  }
  return { role: "PUBLIC", businessId: null, email: user?.email ?? null };
}
