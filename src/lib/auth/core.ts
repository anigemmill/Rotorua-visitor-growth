// Authentication logic that does not touch Next.js request APIs, so it can
// be exercised directly by tests. Cookie handling lives in ./session.ts.

import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma";
import { verifyPassword } from "./password";
import { hashToken, newSessionToken, SESSION_TTL_DAYS } from "./tokens";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  operatorId: string | null;
}

const LOCKOUT_WINDOW_MIN = 15;
const LOCKOUT_MAX_FAILURES = 8;

export type LoginResult =
  | { ok: true; user: AuthUser; token: string; expiresAt: Date }
  | { ok: false; error: string };

export async function attemptLogin(
  emailRaw: string,
  password: string,
  userAgent?: string | null
): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MIN * 60_000);
  const recentFailures = await prisma.loginAttempt.count({
    where: { email, success: false, createdAt: { gte: since } },
  });
  if (recentFailures >= LOCKOUT_MAX_FAILURES) {
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${LOCKOUT_WINDOW_MIN} minutes.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && user.active ? await verifyPassword(password, user.passwordHash) : false;
  // Operators must be linked to a business; an unlinked operator account is unusable.
  const linked = user ? user.role !== "OPERATOR" || !!user.operatorId : false;

  await prisma.loginAttempt.create({ data: { email, success: Boolean(valid && linked) } });

  if (!user || !valid || !linked) {
    return { ok: false, error: "Email or password is incorrect." };
  }

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await prisma.authSession.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt, userAgent: userAgent ?? null },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "login", entityType: "user", entityId: user.id, summary: "Signed in" },
  });

  return {
    ok: true,
    token,
    expiresAt,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, operatorId: user.operatorId },
  };
}

export async function userForToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.active) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const u = session.user;
  if (u.role === "OPERATOR" && !u.operatorId) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, operatorId: u.operatorId };
}

export async function revokeToken(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
