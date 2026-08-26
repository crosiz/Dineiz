import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const messages = await prisma.superAdminMessage.findMany({
      orderBy: { sentAt: 'desc' },
      take: 100,
      include: {
        superAdmin: { select: { name: true, email: true } },
        tenant: { select: { name: true } },
      },
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Fetch message history error:', error);
    return NextResponse.json({ error: 'Failed to fetch message history' }, { status: 500 });
  }
}
