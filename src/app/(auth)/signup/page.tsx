import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PASSWORD_MIN_LENGTH } from "@/lib/platform/passwords";
import { safeNext } from "@/lib/web/redirects";
import { getCurrentUser } from "@/lib/web/session";
import { signUpAction } from "../actions";

export const metadata = { title: "Create account" };

export default async function SignUpPage(props: PageProps<"/signup">) {
  const { next, email } = await props.searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <>
      <h1 className="text-lg font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">You&apos;ll set up your business workspace next.</p>
      <div className="mt-5">
        <ActionForm action={signUpAction}>
          <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
          <Field name="name" label="Your name" autoComplete="name" required />
          <Field
            name="email"
            label="Work email"
            type="email"
            autoComplete="email"
            defaultValue={typeof email === "string" ? email : undefined}
            required
          />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
            required
          />
          <FormStatus />
          <SubmitButton>Create account</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        Already have an account?{" "}
        <Link href={typeof next === "string" ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-teal-700 underline dark:text-teal-400">
          Sign in
        </Link>
      </p>
    </>
  );
}
