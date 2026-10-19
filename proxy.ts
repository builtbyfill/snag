import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { readAuthEnv } from "@/lib/env";

/**
 * Sends a dashboard request without a valid session to /login before anything renders. A
 * convenience, not the gate: every dashboard page and action calls requireSession() itself.
 * (Next 16 renamed middleware.ts to proxy.ts; it runs on the Node.js runtime.)
 */
export function proxy(request: NextRequest) {
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, readAuthEnv())) return NextResponse.next();
  // An image URL without a session gets the same 404 the route gives: nothing to learn from it.
  if (request.nextUrl.pathname.startsWith("/dashboard/images/")) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: "/dashboard/:path*",
};
