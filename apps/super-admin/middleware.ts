import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SUPERADMIN_COOKIE_NAME, verifySuperAdminToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, _next, public, login page, and login API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/login' ||
    pathname === '/api/auth/login'
  ) {
    return NextResponse.next();
  }

  // Cron endpoints are called by Vercel's scheduler, not a browser session —
  // they authenticate via a bearer token checked inside the route itself.
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  // Resend's webhook is called by Resend's servers, not a browser session —
  // it authenticates via the Svix signature checked inside the route itself.
  if (pathname === '/api/webhooks/resend') {
    return NextResponse.next();
  }

  const token = request.cookies.get(SUPERADMIN_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized super admin access' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifySuperAdminToken(token);

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid or expired super admin session' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(SUPERADMIN_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
