import "server-only";

// Maps service errors to form state for useActionState. Domain errors carry
// customer-safe messages; anything else is logged server-side and reported
// generically so internals never reach the browser.

import { unstable_rethrow } from "next/navigation";
import { DomainError, ValidationError } from "@/lib/platform/errors";
import type { ActionState } from "./types";

export type { ActionState };

export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message || "Saved." };
  } catch (e) {
    // redirect()/notFound() work by throwing; let them through.
    unstable_rethrow(e);
    if (e instanceof ValidationError) return { error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof DomainError) return { error: e.message };
    console.error("Unhandled action error", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}
