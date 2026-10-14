import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/platform/audit";
import { signUp, type PublicUser } from "@/lib/platform/auth";
import { acceptInvitation, createInvitation } from "@/lib/platform/account";
import { memoryOutbox, type EmailMessage } from "@/lib/platform/email";
import { createOrganization, getOrgContext, type OrgContext } from "@/lib/platform/organizations";

const PLATFORM_TABLES = [
  "Invitation",
  "UserToken",
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
  memoryOutbox.length = 0;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${PLATFORM_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

export const meta = { ipAddress: "203.0.113.10", userAgent: "vitest" };

let counter = 0;
/** A signed-up user. Verified by default, since most flows require it. */
export async function makeUser(name = "Test User", opts: { verified?: boolean } = {}): Promise<PublicUser> {
  counter += 1;
  const user = await signUp({ name, email: `user${counter}-${Date.now()}@example.com`, password: "correct horse battery" }, {
    ...meta,
    ipAddress: null,
  });
  if (opts.verified === false) return user;
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { ...user, emailVerified: true };
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

export function lastEmail(to: string, tag?: EmailMessage["tag"]): EmailMessage {
  const msg = [...memoryOutbox].reverse().find((m) => m.to === to && (!tag || m.tag === tag));
  if (!msg) throw new Error(`No ${tag ?? ""} email sent to ${to}`);
  return msg;
}

/** The token from the link in an email. */
export function tokenFrom(msg: EmailMessage): string {
  const url = msg.text.match(/https?:\/\/\S+/)?.[0];
  const token = url && new URL(url).searchParams.get("token");
  if (!token) throw new Error("No token link in email");
  return token;
}

export async function inviteAndAccept(ctx: OrgContext, user: PublicUser, role: "ADMIN" | "MEMBER" | "VIEWER") {
  await createInvitation(ctx, { email: user.email, role });
  await acceptInvitation(user, tokenFrom(lastEmail(user.email, "invitation")), actorFor(user));
  return prisma.membership.findFirstOrThrow({ where: { organizationId: ctx.organization.id, userId: user.id } });
}
