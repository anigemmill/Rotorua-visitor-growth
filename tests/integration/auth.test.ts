import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  authenticate,
  createSession,
  revokeAllSessions,
  revokeSessionToken,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  signUp,
  validateSessionToken,
} from "@/lib/platform/auth";
import { RateLimitedError, UnauthenticatedError, ValidationError } from "@/lib/platform/errors";
import { hashToken } from "@/lib/platform/tokens";
import { meta, resetDb } from "../helpers/db";

const creds = { name: "Ana", email: "Ana@Example.com", password: "a long enough password" };

beforeEach(resetDb);

describe("sign-up", () => {
  it("creates a user with a hashed password and lower-cased email", async () => {
    const user = await signUp(creds, meta);
    expect(user.email).toBe("ana@example.com");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toContain(creds.password);
    expect(row.platformRole).toBe("NONE");
  });
  it("rejects weak passwords and duplicate emails", async () => {
    await expect(signUp({ ...creds, password: "short" }, meta)).rejects.toBeInstanceOf(ValidationError);
    await signUp(creds, meta);
    await expect(signUp(creds, meta)).rejects.toBeInstanceOf(ValidationError);
  });
  it("cannot self-assign a platform role", async () => {
    const user = await signUp({ ...creds, platformRole: "SUPER_ADMIN" } as typeof creds, meta);
    expect(user.platformRole).toBe("NONE");
  });
});

describe("login", () => {
  it("accepts correct credentials and records an audit event", async () => {
    await signUp(creds, meta);
    const user = await authenticate({ email: "ana@example.com", password: creds.password }, meta);
    expect(user.email).toBe("ana@example.com");
    expect(await prisma.auditEvent.count({ where: { action: "auth.login", actorUserId: user.id } })).toBe(1);
  });
  it("gives the same generic error for unknown email and wrong password", async () => {
    await signUp(creds, meta);
    const a = await authenticate({ email: "nobody@example.com", password: "x" }, meta).catch((e) => e);
    const b = await authenticate({ email: "ana@example.com", password: "wrong password" }, meta).catch((e) => e);
    expect(a).toBeInstanceOf(UnauthenticatedError);
    expect(b).toBeInstanceOf(UnauthenticatedError);
    expect(a.message).toBe(b.message);
  });
  it("blocks disabled users", async () => {
    const u = await signUp(creds, meta);
    await prisma.user.update({ where: { id: u.id }, data: { disabledAt: new Date() } });
    await expect(authenticate({ email: u.email, password: creds.password }, meta)).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });
  it("rate-limits repeated attempts on one account", async () => {
    await signUp(creds, meta);
    for (let i = 0; i < 10; i++) {
      await authenticate({ email: "ana@example.com", password: "wrong" }, meta).catch(() => {});
    }
    await expect(authenticate({ email: "ana@example.com", password: creds.password }, meta)).rejects.toBeInstanceOf(
      RateLimitedError
    );
  });
});

describe("sessions", () => {
  it("stores only the token hash and validates the token", async () => {
    const u = await signUp(creds, meta);
    const { token } = await createSession(u.id, meta);
    const row = await prisma.authSession.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
    expect((await validateSessionToken(token))?.user.id).toBe(u.id);
    expect(await validateSessionToken("not-a-real-token")).toBeNull();
  });
  it("expires on absolute lifetime and on idle timeout", async () => {
    const u = await signUp(creds, meta);
    const start = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(u.id, meta, start);
    expect(await validateSessionToken(token, new Date(start.getTime() + SESSION_IDLE_TTL_MS + 1000))).toBeNull();

    const { token: t2 } = await createSession(u.id, meta, start);
    // Keep it active by touching it every 6 days until just past the absolute limit.
    let now = start.getTime();
    while (now + 6 * 86400_000 < start.getTime() + SESSION_ABSOLUTE_TTL_MS) {
      now += 6 * 86400_000;
      expect(await validateSessionToken(t2, new Date(now))).not.toBeNull();
    }
    expect(await validateSessionToken(t2, new Date(start.getTime() + SESSION_ABSOLUTE_TTL_MS + 1))).toBeNull();
  });
  it("can be revoked individually or all at once, and dies when the user is disabled", async () => {
    const u = await signUp(creds, meta);
    const a = await createSession(u.id, meta);
    const b = await createSession(u.id, meta);
    await revokeSessionToken(a.token);
    expect(await validateSessionToken(a.token)).toBeNull();
    expect(await validateSessionToken(b.token)).not.toBeNull();
    const c = await createSession(u.id, meta);
    await prisma.user.update({ where: { id: u.id }, data: { disabledAt: new Date() } });
    expect(await validateSessionToken(c.token)).toBeNull();
    expect(await revokeAllSessions(u.id)).toBe(2);
  });
});

describe("email normalisation", () => {
  it("accepts surrounding spaces and mixed case at sign-up and login", async () => {
    await signUp({ ...creds, email: "  Mixed.Case@Example.COM " }, meta);
    await expect(authenticate({ email: " mixed.case@example.com  ", password: creds.password }, meta)).resolves.toMatchObject({
      email: "mixed.case@example.com",
    });
  });
});
