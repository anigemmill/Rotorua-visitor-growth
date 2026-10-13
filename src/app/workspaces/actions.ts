"use server";

import { redirect } from "next/navigation";
import { createOrganization } from "@/lib/platform/organizations";
import { formObject, runAction, type ActionState } from "@/lib/web/action-state";
import { actorFor, requireUser } from "@/lib/web/session";

export async function createWorkspaceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let slug = "";
  const result = await runAction(async () => {
    const org = await createOrganization(user, { name: formObject(formData).name ?? "" }, await actorFor(user));
    slug = org.slug;
  });
  if (result?.ok) redirect(`/app/${slug}`);
  return result;
}
