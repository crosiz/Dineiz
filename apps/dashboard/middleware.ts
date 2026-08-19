import { NextResponse, type NextRequest } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "better-auth/api";

const TENANT_ADMIN_ROUTES = [
  '/dashboard/branches',
  '/dashboard/analytics',
  '/dashboard/customers',
  '/dashboard/fleet',
  '/dashboard/integrations',
  '/dashboard/deals',
  '/dashboard/loyalty',
  '/dashboard/anomalies',
  '/dashboard/forecast',
  '/dashboard/settings/branding',
  '/dashboard/settings/billing',
  '/dashboard/qr',
];

// These bases also have legitimate branch-manager sub-routes
// (/dashboard/menu/availability, /dashboard/staff/shift,
// /dashboard/reports/today, /dashboard/reports/shift), so they can't go in
// the prefix-matched list above without also blocking those — only the
// bare page itself is restricted.
const TENANT_ADMIN_EXACT_ROUTES = [
  '/dashboard/menu',
  '/dashboard/staff',
  '/dashboard/reports',
  '/dashboard/settings',
];

export async function middleware(request: NextRequest) {
  // Only check dashboard routes
  if (!request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  try {
    const { data: session } = await betterFetch<Session>(
      "/api/auth/get-session",
      {
        baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      }
    );

    // If not logged in, redirect to login
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const role = (session.user as any).role;
    
    // Check if BRANCH_MANAGER is trying to access a TENANT_ADMIN route
    if (role === 'BRANCH_MANAGER') {
      const isRestricted = TENANT_ADMIN_ROUTES.some(route =>
        request.nextUrl.pathname.startsWith(route)
      ) || TENANT_ADMIN_EXACT_ROUTES.includes(request.nextUrl.pathname);

      if (isRestricted) {
        return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
      }
    }
    
    return NextResponse.next();
  } catch (err) {
    // Fallback to allow if auth server is unreachable during build or dev
    console.error('Middleware fetch error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
