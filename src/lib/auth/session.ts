import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userForToken, type AuthUser } from "./core";
import { SESSION_COOKIE } from "./tokens";

export type { AuthUser };

/** Current user for this request, memoised per render pass. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  return userForToken(store.get(SESSION_COOKIE)?.value);
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isStaff(user: AuthUser): boolean {
  return user.role === "FOUNDER" || user.role === "ADMIN";
}

/** Programme staff only. Operators are sent to their portal. */
export async function requireStaff(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/portal");
  return user;
}

/** Founder only (commercial data, user management). */
export async function requireFounder(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "FOUNDER") redirect(isStaff(user) ? "/" : "/portal");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
