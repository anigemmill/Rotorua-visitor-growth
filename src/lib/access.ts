// Row-level access filtering by AccessLevel + role (docs/ARCHITECTURE.md §6).
//
// Rule: a PRIVATE_BUSINESS row is visible only to destination-admin/partner
// roles and to the business that owns it — never to another business, and
// never to the public. Everything else is visible per its own access level.

import type { AccessLevel } from "@/generated/prisma";
import type { Session } from "./session";

const ROLE_VISIBLE_LEVELS: Record<Session["role"], AccessLevel[]> = {
  PUBLIC: ["PUBLIC", "AGGREGATED"],
  BUSINESS: ["PUBLIC", "AGGREGATED", "MODEL_INFERENCE"], // + own PRIVATE_BUSINESS rows, checked separately
  PARTNER: ["PUBLIC", "AGGREGATED", "MODEL_INFERENCE", "PARTNER", "PRIVATE_BUSINESS"],
  ADMIN: ["PUBLIC", "AGGREGATED", "MODEL_INFERENCE", "PARTNER", "PRIVATE_BUSINESS"],
};

/**
 * Returns true if the session may see a row with the given access level and
 * (for PRIVATE_BUSINESS rows) owning business id.
 */
export function canView(
  session: Session,
  accessLevel: AccessLevel,
  ownerBusinessId?: string | null
): boolean {
  if (accessLevel === "PRIVATE_BUSINESS") {
    if (session.role === "PARTNER" || session.role === "ADMIN") return true;
    if (session.role === "BUSINESS" && ownerBusinessId && session.businessId === ownerBusinessId) {
      return true;
    }
    return false;
  }
  return ROLE_VISIBLE_LEVELS[session.role].includes(accessLevel);
}

/** Prisma `where` fragment: access levels a session may see, excluding the
 * business-owned-PRIVATE_BUSINESS special case (apply that with a separate
 * OR clause including ownerBusinessId when querying a table that has one). */
export function visibleAccessLevels(session: Session): AccessLevel[] {
  if (session.role === "PARTNER" || session.role === "ADMIN") {
    return ["PUBLIC", "AGGREGATED", "MODEL_INFERENCE", "PARTNER", "PRIVATE_BUSINESS"];
  }
  return ROLE_VISIBLE_LEVELS[session.role];
}
