import { NextResponse } from 'next/server';
import { SUPERADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SUPERADMIN_COOKIE_NAME);
  return response;
}
