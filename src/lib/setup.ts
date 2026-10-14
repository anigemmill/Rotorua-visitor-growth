// One-time first-run setup for hosted deployments. Available only while
// SETUP_TOKEN is configured (≥ 24 chars) AND the database has no users.
// Once the founder exists, setup is permanently unavailable (until all
// users are deleted), regardless of the token.

import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { seedDestination } from "@/lib/seed/destination";
import { seedGrowthOs } from "@/lib/seed/growth";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export const MIN_SETUP_TOKEN_LENGTH = 24;

export function setupTokenConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SETUP_TOKEN ?? "").length >= MIN_SETUP_TOKEN_LENGTH;
}

export function tokenMatches(supplied: string, env: Record<string, string | undefined> = process.env): boolean {
  const expected = env.SETUP_TOKEN ?? "";
  if (expected.length < MIN_SETUP_TOKEN_LENGTH) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setupAvailable(): Promise<boolean> {
  if (!setupTokenConfigured()) return false;
  return (await prisma.user.count()) === 0;
}

export type SetupResult = { ok: true } | { ok: false; error: string };

export async function completeSetup(input: {
  token: string;
  name: string;
  email: string;
  password: string;
  programmeStart?: Date;
}): Promise<SetupResult> {
  if (!tokenMatches(input.token)) return { ok: false, error: "Setup token is incorrect." };
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  if ((await prisma.user.count()) > 0) return { ok: false, error: "Setup has already been completed." };

  await seedDestination(prisma);
  await seedGrowthOs(prisma, {
    founder: { email: input.email, name: input.name, password: input.password },
    programmeStart: input.programmeStart,
    demo: false, // never demo data on a hosted database via setup
    quiet: true,
  });
  const founder = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  await prisma.auditLog.create({
    data: { actorId: founder?.id ?? null, action: "setup", entityType: "system", summary: "First-run setup completed; founder account created" },
  });
  return { ok: true };
}
