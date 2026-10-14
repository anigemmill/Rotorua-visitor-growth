import Link from "next/link";
import { ActionForm, FormStatus, SubmitButton } from "@/components/platform/forms";
import { ButtonLink, Notice } from "@/components/platform/ui";
import { previewInvitation } from "@/lib/platform/account";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/platform/permissions";
import { getCurrentUser } from "@/lib/web/session";
import { acceptInvitationAction, logoutAction } from "../actions";

export const metadata = { title: "Invitation", referrer: "no-referrer" };

export default async function InvitePage(props: PageProps<"/invite">) {
  const { token } = await props.searchParams;
  const t = typeof token === "string" ? token : "";
  const [preview, user] = await Promise.all([previewInvitation(t), getCurrentUser()]);

  if (!preview.valid) {
    return (
      <>
        <h1 className="text-lg font-semibold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">{preview.reason}</p>
      </>
    );
  }

  const here = `/invite?token=${encodeURIComponent(t)}`;
  return (
    <>
      <h1 className="text-lg font-semibold">Join {preview.organizationName}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        You&apos;ve been invited as <strong>{MEMBERSHIP_ROLE_LABELS[preview.role]}</strong>. This invitation is for{" "}
        <strong>{preview.email}</strong>.
      </p>
      <div className="mt-5">
        {!user ? (
          <div className="flex gap-3">
            <ButtonLink href={`/signup?email=${encodeURIComponent(preview.email)}&next=${encodeURIComponent(here)}`}>Create account</ButtonLink>
            <ButtonLink variant="secondary" href={`/login?next=${encodeURIComponent(here)}`}>
              Sign in
            </ButtonLink>
          </div>
        ) : user.email !== preview.email ? (
          <div className="space-y-3">
            <Notice tone="warn">
              You&apos;re signed in as {user.email}. Sign out and sign in as {preview.email} to accept.
            </Notice>
            <form action={logoutAction}>
              <button className="text-sm underline">Sign out</button>
            </form>
          </div>
        ) : (
          <ActionForm action={acceptInvitationAction}>
            <input type="hidden" name="token" value={t} />
            <FormStatus />
            <SubmitButton>Accept and open workspace</SubmitButton>
          </ActionForm>
        )}
      </div>
      <p className="mt-6 text-xs text-black/50 dark:text-white/50">
        Not expecting this? You can ignore it. <Link href="/" className="underline">About Tourism Intelligence</Link>
      </p>
    </>
  );
}
