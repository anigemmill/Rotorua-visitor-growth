"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { completeSetup, setupAvailable } from "@/lib/setup";
import { f, parseForm, type ActionState } from "@/lib/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const schema = z
  .object({
    token: z.string().min(1, "Enter the setup token."),
    name: f.str(),
    email: z.email({ error: "Enter a valid email." }),
    password: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
    confirm: z.string(),
    programmeStart: f.optDate(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function runSetup(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await setupAvailable())) return { error: "Setup is not available." };
  const parsed = parseForm(schema, fd);
  if (parsed.error) return parsed.error;
  const res = await completeSetup(parsed.data);
  if (!res.ok) return { error: res.error };
  redirect("/login?setup=done");
}
