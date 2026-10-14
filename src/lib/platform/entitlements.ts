// Licence → access resolution. Pure functions only (no DB), so the
// commercial rules are exhaustively unit-testable.
//
// Two separate questions are answered here:
//   1. Access mode — given a licence's status and dates, may the tenant use
//      the product fully, read-only, or not at all?
//   2. Entitlements — which features, limits, reporting options, support tier
//      and AI usage allowance does the tenant's plan (plus any per-licence
//      overrides) grant?
//
// Every commercial value lives in data (Plan.entitlements, overridable per
// License) — see prisma/catalogue/tourism.ts. Nothing here hard-codes a
// plan. The commercial licence agreement is a legal document; this module is
// only the technical enforcement of whatever that agreement grants.

import * as z from "zod";
import type { LicenseStatus } from "@/generated/prisma";

export const FEATURE_KEYS = [
  "integrations.website",
  "integrations.ga4",
  "integrations.search_console",
  "integrations.google_ads",
  "integrations.meta_ads",
  "integrations.social",
  "integrations.booking",
  "reports.weekly_brief",
  "reports.website_search",
  "reports.campaign",
  "reports.commercial",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Countable limits. `null` means no limit ("Custom" plans set real numbers per agreement via overrides). */
export const LIMIT_KEYS = ["brands", "users", "integrations", "historyDays", "customWorkflows"] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export const REPORT_CADENCES = ["daily", "weekly", "monthly"] as const;
export type ReportCadence = (typeof REPORT_CADENCES)[number];

export const SUPPORT_TIERS = ["standard", "priority", "dedicated"] as const;
export type SupportTier = (typeof SUPPORT_TIERS)[number];

const limitValue = z.number().int().nonnegative().nullable();

/**
 * Claude API usage allowance per calendar month (UTC), in US dollars because
 * that is what the provider bills. Never unlimited: the schema requires a
 * positive allowance and caps the hard limit at 2× the allowance.
 */
export const AiAllowanceSchema = z
  .object({
    monthlyAllowanceUsd: z.number().positive().max(100_000),
    /** Warn the workspace (and staff) once usage passes this share of the allowance. */
    warnAtPercent: z.number().int().min(1).max(100).default(80),
    /** New AI work is refused once usage would pass this share. 100 = stop at the allowance. */
    hardLimitPercent: z.number().int().min(100).max(200).default(100),
  })
  .refine((a) => a.warnAtPercent <= a.hardLimitPercent, "warnAtPercent must not exceed hardLimitPercent");

export type AiAllowance = z.infer<typeof AiAllowanceSchema>;

export const EntitlementsSchema = z.object({
  features: z.partialRecord(z.enum(FEATURE_KEYS), z.boolean()).default({}),
  limits: z.partialRecord(z.enum(LIMIT_KEYS), limitValue).default({}),
  reporting: z
    .object({ cadences: z.array(z.enum(REPORT_CADENCES)).max(3).default([]) })
    .default({ cadences: [] }),
  support: z.object({ tier: z.enum(SUPPORT_TIERS) }).default({ tier: "standard" }),
  /** Absent = no AI usage at all (e.g. no licence). */
  ai: AiAllowanceSchema.nullable().default(null),
});

export type Entitlements = z.infer<typeof EntitlementsSchema>;

/** Licence overrides: any subset, merged section by section over the plan. */
export const EntitlementOverridesSchema = z.object({
  features: z.partialRecord(z.enum(FEATURE_KEYS), z.boolean()).optional(),
  limits: z.partialRecord(z.enum(LIMIT_KEYS), limitValue).optional(),
  reporting: z.object({ cadences: z.array(z.enum(REPORT_CADENCES)).max(3) }).optional(),
  support: z.object({ tier: z.enum(SUPPORT_TIERS) }).optional(),
  ai: z
    .object({
      monthlyAllowanceUsd: z.number().positive().max(100_000).optional(),
      warnAtPercent: z.number().int().min(1).max(100).optional(),
      hardLimitPercent: z.number().int().min(100).max(200).optional(),
    })
    .optional(),
});

export type EntitlementOverrides = z.infer<typeof EntitlementOverridesSchema>;

/** Human labels, used in the catalogue and admin UI. */
export const LIMIT_LABELS: Record<LimitKey, string> = {
  brands: "brands",
  users: "users",
  integrations: "connected integrations",
  historyDays: "days of reporting history",
  customWorkflows: "custom workflows",
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  "integrations.website": "Website & sitemap analysis",
  "integrations.ga4": "Google Analytics 4",
  "integrations.search_console": "Google Search Console",
  "integrations.google_ads": "Google Ads",
  "integrations.meta_ads": "Meta Ads",
  "integrations.social": "Social platforms",
  "integrations.booking": "Booking & reservation systems",
  "reports.weekly_brief": "Weekly Intelligence Brief",
  "reports.website_search": "Website & Search Report",
  "reports.campaign": "Campaign Performance Report",
  "reports.commercial": "Commercial Performance Report",
};

export const SUPPORT_LABELS: Record<SupportTier, string> = {
  standard: "Standard support",
  priority: "Priority support",
  dedicated: "Dedicated support",
};

/** Plan entitlements with licence overrides merged on top. */
export function mergeEntitlements(planEntitlements: unknown, overrides: unknown): Entitlements {
  const base = EntitlementsSchema.parse(planEntitlements ?? {});
  const over = overrides == null ? {} : EntitlementOverridesSchema.parse(overrides);
  const ai = base.ai || over.ai?.monthlyAllowanceUsd ? AiAllowanceSchema.parse({ ...(base.ai ?? {}), ...(over.ai ?? {}) }) : null;
  return {
    features: { ...base.features, ...(over.features ?? {}) },
    limits: { ...base.limits, ...(over.limits ?? {}) },
    reporting: over.reporting ?? base.reporting,
    support: over.support ?? base.support,
    ai,
  };
}

export function hasFeature(e: Entitlements, feature: FeatureKey): boolean {
  return e.features[feature] === true;
}

/**
 * Returns the numeric limit, `null` for no limit. A limit key the plan does
 * not mention is treated as 0 — entitlements must be granted explicitly,
 * never by omission.
 */
export function limitFor(e: Entitlements, key: LimitKey): number | null {
  const v = e.limits[key];
  return v === undefined ? 0 : v;
}

export function withinLimit(e: Entitlements, key: LimitKey, currentCount: number, adding = 1): boolean {
  const max = limitFor(e, key);
  return max === null || currentCount + adding <= max;
}

export function allowsCadence(e: Entitlements, cadence: ReportCadence): boolean {
  return e.reporting.cadences.includes(cadence);
}

/** Earliest date the tenant may report on; null when history is unlimited. */
export function historyStart(e: Entitlements, now: Date = new Date()): Date | null {
  const days = limitFor(e, "historyDays");
  return days === null ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Access mode
// ---------------------------------------------------------------------------

export type AccessMode = "full" | "read_only" | "none";

export interface LicenseLike {
  status: LicenseStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceDays: number;
}

export interface AccessDecision {
  mode: AccessMode;
  /** Customer-facing explanation. */
  reason: string;
  /** True while running on a grace period — show a billing warning. */
  inGracePeriod: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * - full:      may run workflows, connect integrations, activate.
 * - read_only: may view, export and delete existing data; nothing that
 *              consumes paid resources or pulls new data.
 * - none:      only billing/licence pages (suspended or no licence).
 */
export function resolveAccess(license: LicenseLike | null, now: Date = new Date()): AccessDecision {
  if (!license) return { mode: "none", reason: "No active licence for this product.", inGracePeriod: false };

  const t = now.getTime();
  const graceEnd = (d: Date) => d.getTime() + license.graceDays * DAY_MS;

  switch (license.status) {
    case "SUSPENDED":
      return { mode: "none", reason: "This licence is suspended. Contact support.", inGracePeriod: false };

    case "TRIALING":
      if (!license.trialEndsAt) {
        return { mode: "read_only", reason: "Trial has no end date configured.", inGracePeriod: false };
      }
      return t < license.trialEndsAt.getTime()
        ? { mode: "full", reason: "Trial active.", inGracePeriod: false }
        : { mode: "read_only", reason: "Your trial has ended.", inGracePeriod: false };

    case "ACTIVE":
      if (!license.currentPeriodEnd || t < license.currentPeriodEnd.getTime()) {
        return { mode: "full", reason: "Licence active.", inGracePeriod: false };
      }
      // Renewal not recorded yet (e.g. webhook delay) — honour the grace period.
      return t < graceEnd(license.currentPeriodEnd)
        ? { mode: "full", reason: "Renewal pending.", inGracePeriod: true }
        : { mode: "read_only", reason: "Your licence period has ended.", inGracePeriod: false };

    case "PAST_DUE":
      if (license.currentPeriodEnd && t < graceEnd(license.currentPeriodEnd)) {
        return { mode: "full", reason: "Payment is overdue.", inGracePeriod: true };
      }
      return { mode: "read_only", reason: "Payment is overdue and the grace period has ended.", inGracePeriod: false };

    case "CANCELLED":
      // Cancelled at period end: keep full access until the paid period ends.
      return license.currentPeriodEnd && t < license.currentPeriodEnd.getTime()
        ? { mode: "full", reason: "Cancelled — access continues until the end of the paid period.", inGracePeriod: false }
        : { mode: "read_only", reason: "This licence has been cancelled.", inGracePeriod: false };

    case "EXPIRED":
      return { mode: "read_only", reason: "This licence has expired.", inGracePeriod: false };
  }
}
