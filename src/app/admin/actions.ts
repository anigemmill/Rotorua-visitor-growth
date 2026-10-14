"use server";

import { revalidatePath } from "next/cache";
import { setLicense } from "@/lib/platform/admin";
import { formObject, runAction, type ActionState } from "@/lib/web/action-state";
import { requireStaffUser } from "@/lib/web/session";

export async function setLicenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireStaffUser();
  const input = formObject(fd);
  const result = await runAction(async () => {
    await setLicense(staff, input.organizationId ?? "", {
      planKey: input.planKey ?? "",
      status: (input.status ?? "") as "ACTIVE",
      trialEndsAt: input.trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
      graceDays: input.graceDays,
      notes: input.notes,
      aiAllowanceUsd: input.aiAllowanceUsd,
      aiHardLimitPercent: input.aiHardLimitPercent,
    });
    return "Licence saved.";
  });
  if (result?.ok) revalidatePath("/admin", "layout");
  return result;
}
