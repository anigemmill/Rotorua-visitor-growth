import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "gos_session";
export const SESSION_TTL_DAYS = 14;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a database leak does not leak live sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
