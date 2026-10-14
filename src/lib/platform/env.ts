// Server-side configuration, validated once on first use. Secrets are read
// only here and only on the server — nothing in this module may be imported
// by a Client Component (enforced by "server-only" in the web layer that
// consumes it; the services themselves stay importable from tests/scripts).

import * as z from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  /**
   * Comma-separated `version:base64key` pairs, e.g. "1:abc...,2:def...".
   * Each key must decode to 32 bytes. The highest version encrypts; every
   * listed version can decrypt, which is how keys are rotated.
   */
  CREDENTIAL_ENCRYPTION_KEYS: z.string().optional(),
  /** Public origin of the app, used for OAuth redirect URIs (Phase 2). */
  APP_URL: z.url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  /**
   * Transactional email: "ses" (production — Amazon SES), "file" (writes each
   * message to EMAIL_FILE_DIR for local dev and CI) or "memory" (tests).
   */
  EMAIL_TRANSPORT: z.enum(["ses", "file", "memory"]).optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FILE_DIR: z.string().optional(),
  /** Escape hatch for CI's production build only; never set in a real deployment. */
  EMAIL_FILE_TRANSPORT_ALLOWED: z.enum(["true", "false"]).optional(),
  /** SES region. Sydney by default (docs/platform/HOSTING.md). */
  SES_REGION: z.string().default("ap-southeast-2"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Name the variables, never print their values.
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

/** Test hook: forget the cached env after mutating process.env. */
export function resetEnvCache(): void {
  cached = null;
}
