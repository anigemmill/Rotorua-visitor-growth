import "server-only";

// Next.js glue between the session cookie and the auth services. Every page,
// server action and route handler that needs a user goes through these
// guards — authorisation is decided here on the server, never in the client.

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Actor } from "@/lib/platform/audit";
import { createSession, revokeSessionToken, validateSessionToken, type PublicUser, type RequestMeta } from "@/lib/platform/auth";
import { requireStaff, type StaffContext } from "@/lib/platform/admin";
import { NotFoundError } from "@/lib/platform/errors";
import { getOrgContext, type OrgContext } from "@/lib/platform/organizations";

const SECURE = process.env.NODE_ENV === "production";
// "__Host-" pins the cookie to this exact host over HTTPS with path=/.
export const SESSION_COOKIE = SECURE ? "__Host-tip_session" : "tip_session";

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  // X-Forwarded-For is only trustworthy behind our own reverse proxy / load
  // balancer, which must overwrite it. See docs/platform/SECURITY.md.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(userId, await getRequestMeta());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await getCurrentUser();
    await revokeSessionToken(token, user ? await actorFor(user) : undefined);
  }
  store.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await validateSessionToken(token);
  return session?.user ?? null;
});

export async function actorFor(user: PublicUser): Promise<Actor> {
  const meta = await getRequestMeta();
  return { userId: user.id, email: user.email, ipAddress: meta.ipAddress };
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Membership-checked context for a workspace; non-members get a 404. */
export const requireOrg = cache(async (orgSlug: string): Promise<OrgContext> => {
  const user = await requireUser();
  try {
    return await getOrgContext(user, orgSlug, await actorFor(user));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});

/** Platform staff only; everyone else gets a 404 so the admin area isn't advertised. */
export async function requireStaffUser(): Promise<StaffContext> {
  const user = await requireUser();
  try {
    return requireStaff(user, await actorFor(user));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}
