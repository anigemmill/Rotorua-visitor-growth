import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { getCurrentUser } from "@/lib/web/session";
import { loginAction } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/workspaces");
  const { next } = await props.searchParams;
  return (
    <>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <div className="mt-5">
        <ActionForm action={loginAction}>
          <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
          <Field name="email" label="Email" type="email" autoComplete="email" required />
          <Field name="password" label="Password" type="password" autoComplete="current-password" required />
          <FormStatus />
          <SubmitButton>Sign in</SubmitButton>
        </ActionForm>
      </div>
      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        New here?{" "}
        <Link href="/signup" className="font-medium text-teal-700 underline dark:text-teal-400">
          Create an account
        </Link>
      </p>
    </>
  );
}
