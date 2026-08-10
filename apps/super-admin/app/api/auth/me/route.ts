import { NextResponse } from 'next/server';
import { getCurrentSuperAdmin } from '@/lib/auth';

export async function GET() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ superAdmin });
}
