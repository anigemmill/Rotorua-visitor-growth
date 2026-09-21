import { NextRequest, NextResponse } from "next/server";
import { DEV_ROLE_COOKIE } from "@/lib/session";

// Development-only role switcher. See TODO(auth) in src/lib/session.ts.
export async function POST(request: NextRequest) {
  const { role } = await request.json();
  if (!["PUBLIC", "PARTNER", "BUSINESS", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const res = NextResponse.json({ role });
  res.cookies.set(DEV_ROLE_COOKIE, role, { path: "/", httpOnly: false });
  return res;
}
