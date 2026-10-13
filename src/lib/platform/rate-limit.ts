// Fixed-window rate limiter backed by Postgres (RateLimitBucket). Atomic via
// a single INSERT … ON CONFLICT statement, so concurrent requests on
// different server instances cannot both slip under the limit.

import { prisma } from "@/lib/prisma";
import { RateLimitedError } from "./errors";

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  loginPerAccount: { limit: 10, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 50, windowSeconds: 15 * 60 },
  signupPerIp: { limit: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/** Increments the bucket and throws RateLimitedError once over the limit. */
export async function consumeRateLimit(key: string, rule: RateLimitRule, now: Date = new Date()): Promise<void> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" = EXCLUDED."windowStart"
                     THEN "RateLimitBucket"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count"
  `;

  if ((rows[0]?.count ?? 0) > rule.limit) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000);
    throw new RateLimitedError(retryAfter);
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
