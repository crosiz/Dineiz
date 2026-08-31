import { NextResponse } from 'next/server';
import { prisma } from '@dineiz/db';
import { v2 as cloudinary } from 'cloudinary';
import { getCurrentSuperAdmin } from '@/lib/auth';
import { logAuditAction } from '@/lib/audit';
import { renderAndStoreInvoice, emailInvoice, buildWhatsAppShareUrl } from '@/lib/invoicing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; paymentId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId, paymentId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action === 'SEND' ? 'SEND' : 'GENERATE';

    const result = await renderAndStoreInvoice(tenantId, paymentId);

    await logAuditAction({
      superAdminId: admin.id,
      action: 'INVOICE_GENERATED',
      targetTenantId: tenantId,
      after: { paymentId, invoiceNumber: result.invoiceNumber },
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      notes: `Generated ${result.payment.status === 'PAID' ? 'receipt' : 'invoice'} ${result.invoiceNumber}`,
    });

    if (action === 'GENERATE') {
      return NextResponse.json({ success: true, invoiceNumber: result.invoiceNumber, invoiceUrl: result.invoiceUrl });
    }

    const sendResult = await emailInvoice(result);
    if (!sendResult.ok) {
      return NextResponse.json({ error: sendResult.error, invoiceUrl: result.invoiceUrl }, { status: sendResult.status });
    }
    return NextResponse.json({ success: true, invoiceNumber: result.invoiceNumber, invoiceUrl: result.invoiceUrl });
  } catch (error: any) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to generate invoice' }, { status: error?.status ?? 500 });
  }
}

// Downloads never hand out a stored URL — the invoice is private on Cloudinary,
// so this mints a freshly signed URL on every request, gated by the same
// super-admin session check as everything else in this app.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; paymentId: string }> }
) {
  try {
    const admin = await getCurrentSuperAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId, paymentId } = await params;
    const share = new URL(request.url).searchParams.get('share');

    const payment = await prisma.paymentHistory.findFirst({ where: { id: paymentId, tenantId } });
    if (!payment?.invoiceUrl || !payment.invoiceNumber) {
      return NextResponse.json({ error: 'No invoice has been generated for this payment yet' }, { status: 404 });
    }

    if (share === 'whatsapp') {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { users: { where: { role: 'TENANT_ADMIN' }, orderBy: { createdAt: 'asc' }, take: 1 } },
      });
      const owner = tenant?.users[0];
      const whatsappUrl = buildWhatsAppShareUrl({
        invoiceUrl: payment.invoiceUrl,
        invoiceNumber: payment.invoiceNumber,
        ownerName: owner?.name,
        ownerPhone: owner?.phone,
        isPaid: payment.status === 'PAID',
      });
      if (!whatsappUrl) {
        return NextResponse.json({ error: 'No phone number on file for this tenant' }, { status: 400 });
      }
      return NextResponse.json({ whatsappUrl });
    }

    // No format arg here — payment.invoiceUrl already ends in `.pdf` (see the
    // comment in renderAndStoreInvoice), and passing 'pdf' again would sign a
    // path Cloudinary never actually stored.
    const signedUrl = cloudinary.utils.private_download_url(payment.invoiceUrl, '', {
      resource_type: 'raw',
      type: 'authenticated',
      attachment: false,
    });

    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error('Invoice download error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to fetch invoice' }, { status: 500 });
  }
}
