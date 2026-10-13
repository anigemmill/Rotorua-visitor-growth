// Licence → access resolution. Pure functions only (no DB), so the
// commercial rules are exhaustively unit-testable.
//
// Two separate questions are answered here:
//   1. Access mode — given a licence's status and dates, may the tenant use
//      the product fully, read-only, or not at all?
//   2. Entitlements — which features and limits does the tenant's plan (plus
//      any per-licence overrides) grant?
//
// The commercial licence agreement is a legal document; this module is only
// the technical enforcement of whatever that agreement grants.

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
  "agents.scheduled_workflows",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const LIMIT_KEYS = [
  "brands",
  "users",
  "integrations",
  "scheduledWorkflows",
  "monthlyAgentRuns",
  "monthlyModelBudgetUsd",
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

const limitValue = z.number().int().nonnegative().nullable(); // null = unlimited

export const EntitlementsSchema = z.object({
  features: z.partialRecord(z.enum(FEATURE_KEYS), z.boolean()).default({}),
  limits: z.partialRecord(z.enum(LIMIT_KEYS), limitValue).default({}),
});

export type Entitlements = z.infer<typeof EntitlementsSchema>;

export const EntitlementOverridesSchema = EntitlementsSchema.partial();

/** Human labels, used in the catalogue and admin UI. */
export const LIMIT_LABELS: Record<LimitKey, string> = {
  brands: "brands",
  users: "users",
  integrations: "connected integrations",
  scheduledWorkflows: "scheduled workflows",
  monthlyAgentRuns: "agent runs per month",
  monthlyModelBudgetUsd: "USD of AI model usage per month",
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
  "agents.scheduled_workflows": "Scheduled agent workflows",
};

/** Plan entitlements with licence overrides merged on top. */
export function mergeEntitlements(planEntitlements: unknown, overrides: unknown): Entitlements {
  const base = EntitlementsSchema.parse(planEntitlements ?? {});
  const over = overrides == null ? {} : EntitlementOverridesSchema.parse(overrides);
  return {
    features: { ...base.features, ...(over.features ?? {}) },
    limits: { ...base.limits, ...(over.limits ?? {}) },
  };
}

export function hasFeature(e: Entitlements, feature: FeatureKey): boolean {
  return e.features[feature] === true;
}

/**
 * Returns the numeric limit, `null` for unlimited. A limit key the plan does
 * not mention is treated as 0 — features must be granted explicitly, never by
 * omission.
 */
export function limitFor(e: Entitlements, key: LimitKey): number | null {
  const v = e.limits[key];
  return v === undefined ? 0 : v;
}

export function withinLimit(e: Entitlements, key: LimitKey, currentCount: number, adding = 1): boolean {
  const max = limitFor(e, key);
  return max === null || currentCount + adding <= max;
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
