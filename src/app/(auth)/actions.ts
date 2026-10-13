"use server";

import { redirect } from "next/navigation";
import { authenticate, signUp } from "@/lib/platform/auth";
import { runAction, formObject, type ActionState } from "@/lib/web/action-state";
import { endSession, getRequestMeta, startSession } from "@/lib/web/session";

/** Only same-site relative paths, to prevent open redirects. */
function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/workspaces";
}

export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const input = formObject(formData);
  const result = await runAction(async () => {
    const user = await signUp(
      { name: input.name ?? "", email: input.email ?? "", password: input.password ?? "" },
      await getRequestMeta()
    );
    await startSession(user.id);
  });
  if (result?.ok) redirect("/workspaces");
  return result;
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const input = formObject(formData);
  const result = await runAction(async () => {
    const user = await authenticate({ email: input.email ?? "", password: input.password ?? "" }, await getRequestMeta());
    await startSession(user.id);
  });
  if (result?.ok) redirect(safeNext(input.next));
  return result;
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
