// Catalogue configuration for the Tourism Intelligence ecosystem — the single
// source of commercial rules. Edit values here and re-run `npm run db:seed`
// (upserts by key); per-customer exceptions go in a licence's
// entitlementOverrides via the admin area. Application code never names a
// plan.
//
// Status: prices are HYPOTHESES for validation (decision 2026-10-14), not
// approved prices. Limits are starting points to tune from pilot data.
//
// AI allowance sizing (assumptions, revisit with Phase 3 cost data):
//   - Provider cost is billed in USD; allowance is expressed in USD.
//   - Planning FX rate: NZ$1 ≈ US$0.58.
//   - Target: model cost ≤ ~20% of plan revenue, so the allowance is
//     never "unlimited" and margins stay positive at the hard limit.
//     Starter  NZ$299 ≈ US$173 → US$35/month
//     Professional NZ$699 ≈ US$405 → US$80/month
//     Enterprise: contract-specific; the default below must be overridden
//     per agreement.

import { EntitlementsSchema, type Entitlements } from "../../src/lib/platform/entitlements";

export const tourismProduct = {
  key: "tourism-intelligence",
  name: "Tourism Intelligence Ecosystem",
  tagline: "Evidence-based visitor growth for tourism businesses.",
  description:
    "Specialist AI agents for website, search and AI visibility, social, trends, paid campaigns, content, visitor growth, pricing and results — coordinated into one prioritised, evidence-backed action plan.",
  version: {
    version: "0.2.0",
    releaseNotes: "Starter / Professional / Enterprise plans, AI usage allowances, account security features.",
  },
};

const entitlements = (e: Entitlements) => EntitlementsSchema.parse(e);

const CORE_FEATURES = {
  "integrations.website": true,
  "integrations.ga4": true,
  "integrations.search_console": true,
  "reports.weekly_brief": true,
  "reports.website_search": true,
} as const;

/** Plans that are no longer offered are deactivated by the seed, never deleted (licences may reference them). */
export const tourismPlans = [
  {
    key: "tourism-starter",
    name: "Starter",
    description: "One brand, your website, Google Analytics and Search Console, with a weekly intelligence brief.",
    billingInterval: "MONTH" as const,
    priceCents: 29900,
    currency: "NZD",
    priceNote: "per month, excl. GST",
    isPublic: true,
    selfServeTrial: true,
    trialDays: 30,
    sortOrder: 1,
    entitlements: entitlements({
      features: { ...CORE_FEATURES },
      limits: { brands: 1, users: 2, integrations: 3, historyDays: 90, customWorkflows: 0 },
      reporting: { cadences: ["weekly"] },
      support: { tier: "standard" },
      ai: { monthlyAllowanceUsd: 35, warnAtPercent: 80, hardLimitPercent: 100 },
    }),
  },
  {
    key: "tourism-professional",
    name: "Professional",
    description: "Up to three brands with advertising and social intelligence, daily or weekly reporting and 12 months of history.",
    billingInterval: "MONTH" as const,
    priceCents: 69900,
    currency: "NZD",
    priceNote: "per month, excl. GST",
    isPublic: true,
    selfServeTrial: false,
    trialDays: null,
    sortOrder: 2,
    entitlements: entitlements({
      features: {
        ...CORE_FEATURES,
        "integrations.google_ads": true,
        "integrations.meta_ads": true,
        "integrations.social": true,
        "reports.campaign": true,
      },
      limits: { brands: 3, users: 5, integrations: 6, historyDays: 365, customWorkflows: 2 },
      reporting: { cadences: ["daily", "weekly"] },
      support: { tier: "priority" },
      ai: { monthlyAllowanceUsd: 80, warnAtPercent: 80, hardLimitPercent: 110 },
    }),
  },
  {
    key: "tourism-enterprise",
    name: "Enterprise",
    description: "Multi-brand and multi-location operators: booking and revenue intelligence, configurable workflows and a dedicated contact.",
    billingInterval: "CUSTOM" as const,
    priceCents: null,
    currency: "NZD",
    priceNote: "Custom agreement",
    isPublic: true,
    selfServeTrial: false,
    trialDays: null,
    sortOrder: 3,
    // "Custom" limits: null here, set per agreement with licence overrides.
    // The AI allowance is never unlimited — this default must be overridden.
    entitlements: entitlements({
      features: {
        ...CORE_FEATURES,
        "integrations.google_ads": true,
        "integrations.meta_ads": true,
        "integrations.social": true,
        "integrations.booking": true,
        "reports.campaign": true,
        "reports.commercial": true,
      },
      limits: { brands: null, users: null, integrations: null, historyDays: null, customWorkflows: null },
      reporting: { cadences: ["daily", "weekly", "monthly"] },
      support: { tier: "dedicated" },
      ai: { monthlyAllowanceUsd: 250, warnAtPercent: 80, hardLimitPercent: 100 },
    }),
  },
];

/**
 * Plans no longer sold. Kept (inactive, hidden) with current-schema
 * entitlements so licences still pointing at them keep working; move those
 * customers to a current plan in the admin area.
 */
export const retiredTourismPlans = [
  {
    key: "tourism-pilot",
    name: "Pilot (retired)",
    description: "Original pilot plan, replaced by Starter on 2026-10-14.",
    billingInterval: "MONTH" as const,
    priceCents: null,
    currency: "NZD",
    priceNote: null,
    isPublic: false,
    active: false,
    selfServeTrial: false,
    trialDays: null,
    sortOrder: 99,
    entitlements: tourismPlans[0].entitlements,
  },
];
