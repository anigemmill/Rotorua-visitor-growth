import { NextResponse, type NextRequest } from "next/server";
import { verifyEmail } from "@/lib/platform/account";
import { DomainError } from "@/lib/platform/errors";
import { getRequestMeta } from "@/lib/web/session";

// The link in the verification email. Verifying on GET is deliberate and
// safe: it only confirms the address the token was sent to, so a mail
// scanner pre-fetching the link has the same effect as the user clicking it.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const target = new URL("/verify-email", request.nextUrl);
  try {
    await verifyEmail(token, await getRequestMeta());
    target.searchParams.set("status", "verified");
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    target.searchParams.set("status", "invalid");
  }
  const res = NextResponse.redirect(target, 303);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
