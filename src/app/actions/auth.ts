"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin, revokeToken } from "@/lib/auth/core";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/tokens";
import type { ActionState } from "@/lib/forms";

const schema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z.string().min(1, "Enter your password.").max(500),
  next: z.string().optional(),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ua = (await headers()).get("user-agent");
  const result = await attemptLogin(parsed.data.email, parsed.data.password, ua);
  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.token, result.expiresAt);
  // Only allow same-site relative redirects.
  const next = parsed.data.next;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(result.user.role === "OPERATOR" ? "/portal" : safeNext ?? "/");
}

export async function logout() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await revokeToken(token);
  await clearSessionCookie();
  redirect("/login");
}
