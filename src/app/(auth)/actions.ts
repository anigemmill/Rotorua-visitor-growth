"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  acceptInvitation,
  checkPasswordResetRequest,
  resetPassword,
  sendPasswordReset,
  sendVerificationEmail,
} from "@/lib/platform/account";
import { authenticate, signUp } from "@/lib/platform/auth";
import { ValidationError } from "@/lib/platform/errors";
import { formObject, runAction, type ActionState } from "@/lib/web/action-state";
import { safeNext } from "@/lib/web/redirects";
import { actorFor, endSession, getRequestMeta, requireUser, startSession } from "@/lib/web/session";


export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const input = formObject(formData);
  const result = await runAction(async () => {
    const user = await signUp(
      { name: input.name ?? "", email: input.email ?? "", password: input.password ?? "" },
      await getRequestMeta()
    );
    await startSession(user.id);
    // A failed send must not fail sign-up; the user can resend from the verify page.
    await sendVerificationEmail(user).catch((e) => console.error("Verification email failed", e));
  });
  if (result?.ok) redirect(input.next ? safeNext(input.next) : "/verify-email");
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

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await requireUser();
  return runAction(async () => {
    if (user.emailVerified) return "Your email address is already confirmed.";
    await sendVerificationEmail(user);
    return `We've sent a new link to ${user.email}.`;
  });
}

const RESET_SENT = "If an account uses that address, we've emailed a link to reset the password. It expires in 30 minutes.";

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const meta = await getRequestMeta();
  return runAction(async () => {
    const email = await checkPasswordResetRequest(formObject(formData).email ?? "", meta);
    // Send after the response so its timing doesn't reveal whether the account exists.
    after(() => sendPasswordReset(email, meta).catch((e) => console.error("Password reset email failed", e)));
    return RESET_SENT;
  });
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const input = formObject(formData);
  const result = await runAction(async () => {
    if (input.password !== input.confirm) {
      throw new ValidationError("The passwords don't match.", {
        confirm: ["The passwords don't match."],
      });
    }
    await resetPassword({ token: input.token ?? "", password: input.password ?? "" }, await getRequestMeta());
  });
  if (result?.ok) redirect("/login?reset=1");
  return result;
}

export async function acceptInvitationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let slug = "";
  const result = await runAction(async () => {
    slug = await acceptInvitation(user, formObject(formData).token ?? "", await actorFor(user));
  });
  if (result?.ok) redirect(`/app/${slug}`);
  return result;
}
