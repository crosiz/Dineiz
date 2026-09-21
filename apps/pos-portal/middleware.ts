import { NextResponse, type NextRequest } from "next/server";

// Presence-only check: does a session cookie exist. The API is the source of
// truth for whether it's actually valid — every request there re-verifies it
// via requireAuth, and lib/api-client.ts sends the browser to /login itself
// on a real 401 (see there for why: this file deliberately does NOT also
// bounce an already-logged-in visitor away from /login. It used to — but a
// cookie that's *present* isn't the same as one that's *valid* server-side
// (expired, or the session/user row is gone, e.g. after a dev DB reset), and
// pairing that redirect with api-client's 401 handler produced an infinite
// loop: 401 sends the browser to /login, middleware sees the still-present
// stale cookie and immediately bounces it back to /dashboard, which 401s
// again. Only gating entry to the portal (the direction below) is safe from
// this, because it doesn't fight over the one route that's a dead end for a
// stale cookie.
const SESSION_COOKIE = "better-auth.session_token";
const PUBLIC_PATHS = ["/login", "/onboarding", "/403"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/* is proxied straight through to pos-portal-api (see the rewrite in
  // next.config.ts) — that server enforces its own auth per-route and
  // returns real 401s. Redirecting an unauthenticated API call to /login
  // would just hand the caller back an HTML page with a 200.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
