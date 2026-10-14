import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/forms";

/**
 * Runs a server-action body, converting unexpected errors into an inline
 * message (Next.js redacts thrown errors on the client). Redirects and
 * not-found signals are re-thrown so they still work.
 */
export async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    console.error("server action failed", err);
    const code = (err as { code?: string })?.code;
    if (code === "P2025") return { error: "That record no longer exists." };
    if (code === "P2002") return { error: "A record with those details already exists." };
    if (code === "P2003") return { error: "This record is linked to other records and cannot be changed that way." };
    return { error: "Something went wrong and nothing was saved. Please try again." };
  }
}
