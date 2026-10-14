import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/platform/audit";
import { signUp, type PublicUser } from "@/lib/platform/auth";
import { createOrganization, getOrgContext } from "@/lib/platform/organizations";

const PLATFORM_TABLES = [
  "UsageAlert",
  "UsageRecord",
  "ModelRate",
  "AuditEvent",
  "RateLimitBucket",
  "IntegrationConnection",
  "Brand",
  "BusinessProfile",
  "License",
  "Plan",
  "ProductVersion",
  "Product",
  "Membership",
  "Organization",
  "AuthSession",
  "User",
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${PLATFORM_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

export const meta = { ipAddress: "203.0.113.10", userAgent: "vitest" };

let counter = 0;
export async function makeUser(name = "Test User"): Promise<PublicUser> {
  counter += 1;
  return signUp({ name, email: `user${counter}-${Date.now()}@example.com`, password: "correct horse battery" }, {
    ...meta,
    ipAddress: null,
  });
}

export function actorFor(user: PublicUser): Actor {
  return { userId: user.id, email: user.email, ipAddress: meta.ipAddress };
}

export async function makeOrg(name: string, owner?: PublicUser) {
  const user = owner ?? (await makeUser(`${name} Owner`));
  const org = await createOrganization(user, { name }, actorFor(user));
  const ctx = await getOrgContext(user, org.slug, actorFor(user));
  return { user, org, ctx };
}

export const TEST_ENTITLEMENTS = {
  features: { "integrations.website": true, "integrations.ga4": true, "integrations.search_console": true },
  limits: { brands: 2, users: 3, integrations: 2, historyDays: 90, customWorkflows: 0 },
  reporting: { cadences: ["weekly"] },
  support: { tier: "standard" },
  ai: { monthlyAllowanceUsd: 10, warnAtPercent: 80, hardLimitPercent: 100 },
};

export async function makeCatalogue(opts: { trialDays?: number | null } = {}) {
  const product = await prisma.product.create({
    data: { key: "tourism-intelligence", name: "Tourism Intelligence", tagline: "t", description: "d" },
  });
  const trialPlan = await prisma.plan.create({
    data: {
      productId: product.id,
      key: "tourism-pilot",
      name: "Pilot",
      description: "Pilot",
      billingInterval: "MONTH",
      selfServeTrial: true,
      trialDays: opts.trialDays === undefined ? 30 : opts.trialDays,
      entitlements: TEST_ENTITLEMENTS,
    },
  });
  const paidPlan = await prisma.plan.create({
    data: {
      productId: product.id,
      key: "tourism-professional",
      name: "Professional",
      description: "Pro",
      billingInterval: "YEAR",
      entitlements: TEST_ENTITLEMENTS,
    },
  });
  return { product, trialPlan, paidPlan };
}

export async function makeModelRates() {
  const { modelRates } = await import("../../prisma/catalogue/model-rates");
  await prisma.modelRate.createMany({ data: modelRates });
}
