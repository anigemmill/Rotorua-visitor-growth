import Link from "next/link";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PASSWORD_MIN_LENGTH } from "@/lib/platform/passwords";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Choose a new password", referrer: "no-referrer" };

// The token is only consumed when the form is submitted (POST), so mail
// scanners that pre-fetch the link can't use it up.
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <>
        <h1 className="text-lg font-semibold">Link missing</h1>
        <p className="mt-2 text-sm">
          <Link href="/forgot-password" className="underline">
            Request a new reset link
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">You&apos;ll be signed out everywhere and can sign in with the new password.</p>
      <div className="mt-5">
        <ActionForm action={resetPasswordAction}>
          <input type="hidden" name="token" value={token} />
          <Field name="password" label="New password" type="password" autoComplete="new-password" hint={`At least ${PASSWORD_MIN_LENGTH} characters.`} required />
          <Field name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
          <FormStatus />
          <SubmitButton>Set new password</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/forgot-password" className="text-teal-700 underline dark:text-teal-400">
          Request a new link
        </Link>
      </p>
    </>
  );
}
