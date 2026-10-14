import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { Notice } from "@/components/platform/ui";
import { safeNext } from "@/lib/web/redirects";
import { getCurrentUser } from "@/lib/web/session";
import { loginAction } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, reset } = await props.searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <>
      <h1 className="text-lg font-semibold">Sign in</h1>
      {reset === "1" && (
        <div className="mt-3">
          <Notice tone="good">Your password was changed. Sign in with the new one.</Notice>
        </div>
      )}
      <div className="mt-5">
        <ActionForm action={loginAction}>
          <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
          <Field name="email" label="Email" type="email" autoComplete="email" required />
          <Field name="password" label="Password" type="password" autoComplete="current-password" required />
          <FormStatus />
          <div className="flex items-center justify-between">
            <SubmitButton>Sign in</SubmitButton>
            <Link href="/forgot-password" className="text-sm text-teal-700 underline dark:text-teal-400">
              Forgot password?
            </Link>
          </div>
        </ActionForm>
      </div>
      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        New here?{" "}
        <Link href={typeof next === "string" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-teal-700 underline dark:text-teal-400">
          Create an account
        </Link>
      </p>
    </>
  );
}
