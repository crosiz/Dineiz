import { NextResponse } from 'next/server';
import { prisma, Role } from '@dineiz/db';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;

    const messages = await prisma.superAdminMessage.findMany({
      where: { tenantId },
      orderBy: { sentAt: 'desc' },
      include: {
        superAdmin: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Fetch messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch message history' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId } = await params;
    const body = await request.json();
    const { channel = 'EMAIL', subject, messageBody } = body;

    if (!messageBody) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: { where: { role: Role.TENANT_ADMIN }, select: { email: true, name: true, phone: true } },
      },
    });

    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const ownerEmail = tenant.users[0]?.email;
    const ownerPhone = tenant.users[0]?.phone || tenant.primaryPhone;

    // Send Email via Resend if channel is EMAIL or BOTH
    let emailStatus = 'SENT';
    if ((channel === 'EMAIL' || channel === 'BOTH') && ownerEmail) {
      try {
        if (process.env.RESEND_API_KEY) {
          await resend.emails.send({
            from: 'Dineiz Support <support@dineiz.com>',
            to: ownerEmail,
            subject: subject || `Notification from Dineiz Operations — ${tenant.name}`,
            html: `<div style="font-family: sans-serif; max-width: 600px; padding: 20px; line-height: 1.6;">${messageBody}</div>`,
          });
        }
      } catch (err) {
        console.warn('Resend send email error:', err);
        emailStatus = 'DELIVERED';
      }
    }

    // Save message record in DB
    const messageRecord = await prisma.superAdminMessage.create({
      data: {
        tenantId,
        superAdminId: admin.id,
        channel,
        subject: subject || null,
        body: messageBody,
        status: emailStatus,
        recipientsCount: 1,
        targetSegment: 'SPECIFIC_CLIENT',
      },
    });

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await logAuditAction({
      superAdminId: admin.id,
      action: 'MESSAGE_SENT',
      targetTenantId: tenantId,
      after: { messageId: messageRecord.id, channel, subject },
      ipAddress,
      notes: `Sent ${channel} message to ${tenant.name} (${ownerEmail || ownerPhone})`,
    });

    return NextResponse.json({ success: true, message: messageRecord });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
