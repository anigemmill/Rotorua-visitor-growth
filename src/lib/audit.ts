import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

/** Record an important change. Failures are logged but never block the change. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  changes?: Prisma.InputJsonValue
) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, summary, changes },
    });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}

/** Shallow diff of two plain objects, for audit `changes`. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key] instanceof Date ? (before[key] as Date).toISOString() : before[key];
    const b = after[key] instanceof Date ? (after[key] as Date).toISOString() : after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = { from: a ?? null, to: b ?? null };
  }
  return out as Prisma.InputJsonValue;
}
