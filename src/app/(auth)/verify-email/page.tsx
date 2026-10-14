import Link from "next/link";
import { ActionForm, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice } from "@/components/platform/ui";
import { getCurrentUser } from "@/lib/web/session";
import { resendVerificationAction } from "../actions";

export const metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const { status } = await props.searchParams;
  const user = await getCurrentUser();

  if (status === "verified" || user?.emailVerified) {
    return (
      <>
        <h1 className="text-lg font-semibold">Email confirmed</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">Thanks — your email address is confirmed.</p>
        <Link href={user ? "/workspaces" : "/login"} className="mt-5 inline-block text-sm font-medium text-teal-700 underline">
          {user ? "Continue to your workspaces" : "Sign in"}
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold">Confirm your email</h1>
      {status === "invalid" && (
        <div className="mt-3">
          <Notice tone="bad">That link is invalid or has expired. Send yourself a new one below.</Notice>
        </div>
      )}
      {user ? (
        <>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            We sent a link to <strong>{user.email}</strong>. Open it to confirm your address — it expires in 24 hours.
          </p>
          <div className="mt-5">
            <ActionForm action={resendVerificationAction}>
              <FormStatus />
              <SubmitButton variant="secondary">Send a new link</SubmitButton>
            </ActionForm>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          <Link href="/login?next=/verify-email" className="underline">
            Sign in
          </Link>{" "}
          to request a new confirmation link.
        </p>
      )}
    </>
  );
}
