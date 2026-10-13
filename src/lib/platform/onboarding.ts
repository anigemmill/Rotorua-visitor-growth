// Guided onboarding: business profile (stage 1), business knowledge
// (stage 2) and brands. Optional fields can be skipped and completed later;
// only the business name is required.

import * as z from "zod";
import type { OnboardingStage } from "@/generated/prisma";
import { recordAudit } from "./audit";
import { fieldErrors } from "./auth";
import { ConflictError, LimitExceededError, NotFoundError, ValidationError } from "./errors";
import { assertWithinLimit, getLicenseState } from "./licensing";
import { requirePermission, type OrgContext } from "./organizations";

export const STAGE_ORDER: OnboardingStage[] = [
  "BUSINESS_PROFILE",
  "BUSINESS_KNOWLEDGE",
  "INTEGRATIONS",
  "VALIDATION",
  "ACTIVATION",
  "COMPLETE",
];

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  BUSINESS_PROFILE: "Business profile",
  BUSINESS_KNOWLEDGE: "Business knowledge",
  INTEGRATIONS: "Connect your tools",
  VALIDATION: "Validate data",
  ACTIVATION: "Activate ecosystem",
  COMPLETE: "Complete",
};

export function stageIndex(stage: OnboardingStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** Moves the organisation forward to `reached` if it isn't already past it. */
export async function advanceStage(ctx: OrgContext, reached: OnboardingStage): Promise<void> {
  if (stageIndex(reached) <= stageIndex(ctx.organization.onboardingStage)) return;
  await ctx.db.organization.update({ where: { id: ctx.organization.id }, data: { onboardingStage: reached } });
  ctx.organization = { ...ctx.organization, onboardingStage: reached };
}

/** Free-text list input: one item per line (or comma-separated), trimmed, de-duplicated. */
const listField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const items = (Array.isArray(v) ? v : (v ?? "").split(/\r?\n|,/)).map((s) => s.trim()).filter(Boolean);
    return [...new Set(items)].slice(0, 50).map((s) => s.slice(0, 200));
  });

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : null))
    .pipe(z.string().max(max).nullable());

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .pipe(
    z
      .string()
      .max(2048)
      .refine((v) => /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full web address starting with https://")
      .nullable()
  );

const timeZone = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .refine((v) => v === null || Intl.supportedValuesOf("timeZone").includes(v), "Choose a valid time zone.");

export const BusinessProfileSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name.").max(160),
  website: optionalUrl,
  country: optionalText(80),
  timeZone,
  businessType: optionalText(120),
  products: listField,
  targetAudiences: listField,
  mainMarkets: listField,
  objectives: listField,
  seasonalPriorities: optionalText(2000),
  competitors: listField,
  marketingChannels: listField,
  kpis: listField,
  constraints: optionalText(2000),
});

export const BusinessKnowledgeSchema = z.object({
  positioning: optionalText(4000),
  approvedMessaging: optionalText(4000),
  toneOfVoice: optionalText(2000),
  uniqueSellingPoints: listField,
  pricingNotes: optionalText(2000),
  brandRestrictions: optionalText(4000),
  culturalGuidelines: optionalText(4000),
});

export async function getProfile(ctx: OrgContext) {
  return ctx.db.businessProfile.findFirst({});
}

export async function updateBusinessProfile(ctx: OrgContext, input: z.input<typeof BusinessProfileSchema>) {
  requirePermission(ctx, "profile.edit");
  const parsed = BusinessProfileSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  const data = { ...parsed.data, updatedById: ctx.user.id };
  await ctx.db.businessProfile.upsert({
    where: { organizationId: ctx.organization.id },
    create: { ...data, organizationId: ctx.organization.id },
    update: data,
  });
  await recordAudit({ actor: ctx.actor, organizationId: ctx.organization.id, action: "profile.updated" });
  await advanceStage(ctx, "BUSINESS_KNOWLEDGE");
}

export async function updateBusinessKnowledge(ctx: OrgContext, input: z.input<typeof BusinessKnowledgeSchema>) {
  requirePermission(ctx, "profile.edit");
  const parsed = BusinessKnowledgeSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  const profile = await ctx.db.businessProfile.findFirst({});
  if (!profile) throw new NotFoundError("Complete your business profile first.");
  await ctx.db.businessProfile.update({
    where: { id: profile.id },
    data: { ...parsed.data, updatedById: ctx.user.id },
  });
  await recordAudit({ actor: ctx.actor, organizationId: ctx.organization.id, action: "knowledge.updated" });
  await advanceStage(ctx, "INTEGRATIONS");
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const BrandSchema = z.object({
  name: z.string().trim().min(1, "Enter the brand name.").max(120),
  website: optionalUrl,
  description: optionalText(1000),
});

export async function listBrands(ctx: OrgContext) {
  return ctx.db.brand.findMany({ orderBy: { name: "asc" } });
}

export async function createBrand(ctx: OrgContext, input: z.input<typeof BrandSchema>) {
  requirePermission(ctx, "brands.manage");
  const parsed = BrandSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));

  const state = await getLicenseState(ctx.db);
  // Brands are configuration, so they're allowed in read-only mode, but the
  // plan's limit always applies; before any licence exists, one brand is allowed.
  const brandCount = await ctx.db.brand.count();
  if (state.license) assertWithinLimit(state, "brands", brandCount);
  else if (brandCount >= 1) throw new LimitExceededError("brands", 1);

  const duplicate = await ctx.db.brand.findFirst({ where: { name: parsed.data.name } });
  if (duplicate) throw new ConflictError("A brand with that name already exists.");
  const brand = await ctx.db.brand.create({ data: { ...parsed.data, organizationId: ctx.organization.id } });
  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "brand.created",
    targetType: "Brand",
    targetId: brand.id,
  });
  return brand;
}

export async function deleteBrand(ctx: OrgContext, brandId: string) {
  requirePermission(ctx, "brands.manage");
  const brand = await ctx.db.brand.findFirst({ where: { id: brandId } });
  if (!brand) throw new NotFoundError("Brand not found.");
  await ctx.db.brand.delete({ where: { id: brand.id } });
  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "brand.deleted",
    targetType: "Brand",
    targetId: brand.id,
  });
}
