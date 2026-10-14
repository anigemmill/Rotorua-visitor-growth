import Link from "next/link";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">We&apos;ll email you a link to choose a new password.</p>
      <div className="mt-5">
        <ActionForm action={forgotPasswordAction}>
          <Field name="email" label="Email" type="email" autoComplete="email" required />
          <FormStatus />
          <SubmitButton>Email me a reset link</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/login" className="text-teal-700 underline dark:text-teal-400">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
