// Catalogue configuration for the Tourism Intelligence ecosystem. These are
// commercial rules, not customer data, and are deliberately provisional:
// prices are unset ("on request") until pricing is decided, and limits are
// starting points to be tuned from pilot usage and cost data.

import { EntitlementsSchema, type Entitlements } from "../../src/lib/platform/entitlements";

export const tourismProduct = {
  key: "tourism-intelligence",
  name: "Tourism Intelligence Ecosystem",
  tagline: "Evidence-based visitor growth for tourism businesses.",
  description:
    "Specialist AI agents for website, search and AI visibility, social, trends, paid campaigns, content, visitor growth, pricing and results — coordinated into one prioritised, evidence-backed action plan.",
  version: { version: "0.1.0", releaseNotes: "Platform foundation: workspaces, licensing, onboarding and connection centre." },
};

const plan = (e: Entitlements) => EntitlementsSchema.parse(e);

export const tourismPlans = [
  {
    key: "tourism-pilot",
    name: "Pilot",
    description: "A guided pilot for one brand using your website, Google Analytics and Search Console.",
    billingInterval: "MONTH" as const,
    priceCents: null,
    isPublic: true,
    selfServeTrial: true,
    trialDays: 30,
    sortOrder: 1,
    entitlements: plan({
      features: {
        "integrations.website": true,
        "integrations.ga4": true,
        "integrations.search_console": true,
        "reports.weekly_brief": true,
        "reports.website_search": true,
      },
      limits: { brands: 1, users: 3, integrations: 3, scheduledWorkflows: 2, monthlyAgentRuns: 50, monthlyModelBudgetUsd: 25 },
    }),
  },
  {
    key: "tourism-professional",
    name: "Professional",
    description: "Full marketing intelligence across web, search, advertising and social for a growing operator.",
    billingInterval: "YEAR" as const,
    priceCents: null,
    isPublic: true,
    selfServeTrial: false,
    trialDays: null,
    sortOrder: 2,
    entitlements: plan({
      features: {
        "integrations.website": true,
        "integrations.ga4": true,
        "integrations.search_console": true,
        "integrations.google_ads": true,
        "integrations.meta_ads": true,
        "integrations.social": true,
        "reports.weekly_brief": true,
        "reports.website_search": true,
        "reports.campaign": true,
        "agents.scheduled_workflows": true,
      },
      limits: { brands: 3, users: 10, integrations: 10, scheduledWorkflows: 10, monthlyAgentRuns: 500, monthlyModelBudgetUsd: 250 },
    }),
  },
  {
    key: "tourism-enterprise",
    name: "Enterprise",
    description: "Multi-brand and multi-location operators, with booking and revenue intelligence and tailored onboarding.",
    billingInterval: "CUSTOM" as const,
    priceCents: null,
    isPublic: true,
    selfServeTrial: false,
    trialDays: null,
    sortOrder: 3,
    entitlements: plan({
      features: {
        "integrations.website": true,
        "integrations.ga4": true,
        "integrations.search_console": true,
        "integrations.google_ads": true,
        "integrations.meta_ads": true,
        "integrations.social": true,
        "integrations.booking": true,
        "reports.weekly_brief": true,
        "reports.website_search": true,
        "reports.campaign": true,
        "reports.commercial": true,
        "agents.scheduled_workflows": true,
      },
      limits: { brands: null, users: null, integrations: null, scheduledWorkflows: null, monthlyAgentRuns: 5000, monthlyModelBudgetUsd: 2000 },
    }),
  },
];
