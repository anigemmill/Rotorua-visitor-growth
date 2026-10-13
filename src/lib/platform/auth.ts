// Authentication services: sign-up, password login and server-side
// sessions. Framework-agnostic — the Next.js cookie handling lives in
// src/lib/web/session.ts, which calls into these.
//
// Session model: an opaque 256-bit random token is set as an HttpOnly cookie;
// only its SHA-256 is stored (AuthSession.tokenHash). Sessions have an
// absolute lifetime and an idle timeout and can be revoked individually or
// all at once (e.g. after a password change or account disable).

import * as z from "zod";
import type { User } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recordAudit, type Actor } from "./audit";
import { UnauthenticatedError, ValidationError } from "./errors";
import { getDummyHash, hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "./passwords";
import { consumeRateLimit, RATE_LIMITS, resetRateLimit } from "./rate-limit";
import { generateToken, hashToken } from "./tokens";

export const SESSION_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export const SignUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(256, "Password is too long."),
});

export type SignUpInput = z.input<typeof SignUpSchema>;

export const LoginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password.").max(256),
});

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export type PublicUser = Pick<User, "id" | "email" | "name" | "platformRole">;

function toPublicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name, platformRole: u.platformRole };
}

export async function signUp(input: SignUpInput, meta: RequestMeta): Promise<PublicUser> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  if (meta.ipAddress) await consumeRateLimit(`signup:ip:${meta.ipAddress}`, RATE_LIMITS.signupPerIp);

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Same message shape as any validation failure; we do not confirm that
    // the address is registered beyond what's unavoidable for sign-up UX.
    throw new ValidationError("An account with this email already exists. Try signing in.", {
      email: ["An account with this email already exists."],
    });
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  await recordAudit({
    actor: { userId: user.id, email: user.email, ipAddress: meta.ipAddress },
    action: "auth.signup",
    targetType: "User",
    targetId: user.id,
  });
  return toPublicUser(user);
}

/** Verifies credentials. Throws UnauthenticatedError with a generic message on any failure. */
export async function authenticate(
  input: { email: string; password: string },
  meta: RequestMeta
): Promise<PublicUser> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) throw new UnauthenticatedError("Invalid email or password.");
  const { email, password } = parsed.data;

  await consumeRateLimit(`login:acct:${email}`, RATE_LIMITS.loginPerAccount);
  if (meta.ipAddress) await consumeRateLimit(`login:ip:${meta.ipAddress}`, RATE_LIMITS.loginPerIp);

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !ok || user.disabledAt) {
    await recordAudit({
      actor: { userId: user?.id ?? null, email, ipAddress: meta.ipAddress },
      action: "auth.login_failed",
      metadata: { reason: !user ? "unknown_email" : user.disabledAt ? "disabled" : "bad_password" },
    });
    throw new UnauthenticatedError("Invalid email or password.");
  }

  await resetRateLimit(`login:acct:${email}`);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    actor: { userId: user.id, email: user.email, ipAddress: meta.ipAddress },
    action: "auth.login",
  });
  return toPublicUser(user);
}

export async function createSession(
  userId: string,
  meta: RequestMeta,
  now: Date = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      lastSeenAt: now,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    },
  });
  return { token, expiresAt };
}

export interface ValidSession {
  sessionId: string;
  user: PublicUser;
}

/** Returns the session's user, or null if the token is unknown, expired, idle, revoked or the user is disabled. */
export async function validateSessionToken(token: string, now: Date = new Date()): Promise<ValidSession | null> {
  if (!token || token.length > 128) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  const t = now.getTime();
  if (
    session.revokedAt ||
    session.expiresAt.getTime() <= t ||
    session.lastSeenAt.getTime() + SESSION_IDLE_TTL_MS <= t ||
    session.user.disabledAt
  ) {
    return null;
  }
  if (t - session.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
    await prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return { sessionId: session.id, user: toPublicUser(session.user) };
}

export async function revokeSessionToken(token: string, actor?: Actor): Promise<void> {
  const res = await prisma.authSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count > 0 && actor) await recordAudit({ actor, action: "auth.logout" });
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const res = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
