// Append-only audit trail for security-relevant and commercial events.
// Never put secrets, tokens or credential material in `metadata`.

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export interface Actor {
  userId: string | null;
  email: string | null;
  ipAddress?: string | null;
}

export const SYSTEM_ACTOR: Actor = { userId: null, email: "system", ipAddress: null };

export interface AuditInput {
  actor: Actor;
  action: string;
  organizationId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

type Db = Pick<typeof prisma, "auditEvent">;

export async function recordAudit(input: AuditInput, db: Db = prisma): Promise<void> {
  await db.auditEvent.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorUserId: input.actor.userId,
      actorEmail: input.actor.email,
      ipAddress: input.actor.ipAddress ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    },
  });
}
