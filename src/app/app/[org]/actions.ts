"use server";

// Server actions for the customer workspace. Each one re-derives the
// caller's OrgContext from the session (membership check) and delegates to a
// service that enforces role, licence and plan limits. Nothing here trusts
// the client beyond the raw form fields.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { connectWebsite, disconnectIntegration } from "@/lib/platform/connections";
import { startTrial } from "@/lib/platform/licensing";
import {
  advanceStage,
  createBrand,
  deleteBrand,
  updateBusinessKnowledge,
  updateBusinessProfile,
} from "@/lib/platform/onboarding";
import { addMember, removeMember, requestOrganizationDeletion, type OrgContext } from "@/lib/platform/organizations";
import { ValidationError } from "@/lib/platform/errors";
import { formObject, runAction, type ActionState } from "@/lib/web/action-state";
import { requireOrg } from "@/lib/web/session";

async function withOrg(formData: FormData, fn: (ctx: OrgContext, input: Record<string, string>) => Promise<string | void>) {
  const input = formObject(formData);
  const slug = input.org ?? "";
  const ctx = await requireOrg(slug);
  const result = await runAction(() => fn(ctx, input));
  if (result?.ok) revalidatePath(`/app/${slug}`, "layout");
  return result;
}

export async function saveProfileAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await updateBusinessProfile(ctx, input as { businessName: string });
    return "Business profile saved.";
  });
}

export async function saveKnowledgeAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await updateBusinessKnowledge(ctx, input);
    return "Business knowledge saved.";
  });
}

export async function addBrandAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await createBrand(ctx, { name: input.name ?? "", website: input.website, description: input.description });
    return "Brand added.";
  });
}

export async function deleteBrandAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await deleteBrand(ctx, input.brandId ?? "");
    return "Brand removed.";
  });
}

export async function connectWebsiteAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    const c = await connectWebsite(ctx, { domain: input.domain ?? "" });
    return `${c.externalAccountId} saved. Crawling starts when the website crawler is released.`;
  });
}

export async function disconnectAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await disconnectIntegration(ctx, input.connectionId ?? "");
    return "Disconnected. Stored credentials for this connection were deleted.";
  });
}

export async function startTrialAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await startTrial(ctx, input.planKey ?? "");
    return "Your pilot has started.";
  });
}

export async function continueFromValidationAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx) => {
    const connected = await ctx.db.integrationConnection.count({ where: { status: { not: "REVOKED" } } });
    if (connected === 0) throw new ValidationError("Connect at least one data source before continuing.");
    await advanceStage(ctx, "ACTIVATION");
    return "Validation step recorded.";
  });
}

export async function addMemberAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await addMember(ctx, { email: input.email ?? "", role: (input.role ?? "VIEWER") as "VIEWER" });
    return "Member added.";
  });
}

export async function removeMemberAction(_: ActionState, fd: FormData) {
  return withOrg(fd, async (ctx, input) => {
    await removeMember(ctx, input.membershipId ?? "");
    return "Member removed.";
  });
}

export async function requestDeletionAction(_: ActionState, fd: FormData) {
  const result = await withOrg(fd, async (ctx, input) => {
    if (input.confirmName !== ctx.organization.name) {
      throw new ValidationError("Type the workspace name exactly to confirm.", { confirmName: ["Name does not match."] });
    }
    await requestOrganizationDeletion(ctx);
  });
  if (result?.ok) redirect("/workspaces");
  return result;
}
