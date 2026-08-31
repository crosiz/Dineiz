import { prisma } from '@dineiz/db';
import { v2 as cloudinary } from 'cloudinary';
import { Resend } from 'resend';
import { buildInvoiceHtml, invoiceEmail } from '@dineiz/email';

const PDF_WORKER_URL = process.env.PDF_WORKER_URL || 'http://localhost:8091';
export const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_dev');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Per-year sequential invoice numbers (INV-2026-0001). Generation is rare and
// admin-only, so a short retry-on-conflict loop is simpler and safe enough —
// a full serializable transaction would be overkill for this volume.
async function assignInvoiceNumber(paymentId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const count = await prisma.paymentHistory.count({ where: { invoiceNumber: { startsWith: prefix } } });
    const candidate = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
    try {
      await prisma.paymentHistory.update({ where: { id: paymentId }, data: { invoiceNumber: candidate } });
      return candidate;
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err; // not a unique-constraint collision — bail
    }
  }
  throw new Error('Could not assign a unique invoice number after 3 attempts');
}

/**
 * Renders the invoice/receipt PDF for an existing PaymentHistory row, uploads
 * it privately to Cloudinary, and stamps the row with its invoice number/url.
 * Shared by both "generate for a recorded payment" (PAID, becomes a receipt)
 * and "generate for the current period" (DUE, becomes an invoice with
 * payment instructions) call sites.
 */
export async function renderAndStoreInvoice(tenantId: string, paymentId: string) {
  const payment = await prisma.paymentHistory.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
      branches: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 1 },
      users: { where: { role: 'TENANT_ADMIN' }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });

  const owner = tenant.users[0];
  const subscription = tenant.subscription;
  const isPaid = payment.status === 'PAID';

  const invoiceNumber = payment.invoiceNumber ?? (await assignInvoiceNumber(payment.id));

  // Prefer the snapshot taken when this row was created over the *live*
  // subscription — a plan or cycle change after the fact must never rewrite
  // an already-issued document. Only legacy rows created before these
  // columns existed fall back to the live subscription.
  const planLabel = payment.planAtIssue ?? subscription?.plan ?? 'subscription';
  const billingCycle = payment.billingCycleAtIssue ?? subscription?.billingCycle;
  const billingCycleLabel = billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly';

  // Derived from this payment's own paidAt/createdAt, not the subscription's
  // *current* period — for any payment other than the most recent one, those
  // are two different things, and pulling the live period would show a stale
  // or even zero-width range on an old document.
  const periodStart = isPaid ? payment.paidAt : payment.createdAt;
  const periodEnd = new Date(periodStart);
  if (billingCycle === 'ANNUAL') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const billingPeriod = `${formatDate(periodStart)} – ${formatDate(periodEnd)}`;

  const paymentDetails = isPaid
    ? undefined
    : await prisma.platformBillingSettings.findUnique({ where: { id: 'platform_billing' } }).then((s) => s ?? undefined);

  const html = buildInvoiceHtml({
    invoiceNumber,
    status: isPaid ? 'PAID' : 'DUE',
    issueDate: formatDate(payment.createdAt),
    paidDate: isPaid ? formatDate(payment.paidAt) : undefined,
    billTo: {
      restaurantName: tenant.name,
      ownerName: owner?.name ?? undefined,
      city: tenant.branches[0]?.city ?? undefined,
      email: owner?.email ?? undefined,
    },
    billingPeriod,
    // A payment method/reference only means something once money has
    // actually moved — showing PaymentHistory's default placeholder value
    // on an unpaid invoice would read as a payment that already happened.
    paymentMethod: isPaid ? payment.method : undefined,
    paymentReference: isPaid ? (payment.reference ?? undefined) : undefined,
    lineItems: [
      {
        description: `Dineiz ${planLabel} plan`,
        detail: payment.description || `${billingCycleLabel} subscription`,
        amount: formatPKR(payment.amount),
      },
    ],
    total: formatPKR(payment.amount),
    paymentDetails,
  });

  const pdfRes = await fetch(`${PDF_WORKER_URL}/render-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  });
  if (!pdfRes.ok) {
    const detail = await pdfRes.text().catch(() => '');
    throw new Error(`Could not reach the PDF service at ${PDF_WORKER_URL}. Start it with \`pnpm --filter @dineiz/pdf-worker dev\`. ${detail.slice(0, 200)}`);
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  // `type: 'authenticated'` keeps invoices out of Cloudinary's public delivery —
  // both because most Cloudinary accounts block unsigned PDF delivery by
  // default (a security setting to stop the service being used to host
  // arbitrary files) and because billing documents shouldn't sit behind a
  // permanent, guessable public URL. Downloads always go through a GET route
  // that mints a fresh signed URL per request.
  //
  // For `resource_type: 'raw'`, Cloudinary bakes the extension into the
  // public_id itself rather than treating it as a separate format — so the
  // id stored here must already end in `.pdf`, and the signed-URL helper
  // must NOT also pass format: 'pdf' or the signature won't match the
  // actual stored resource.
  const invoicePublicId = `dineiz-invoices/${tenantId}/${invoiceNumber}.pdf`;
  await cloudinary.uploader.upload(`data:application/pdf;base64,${pdfBuffer.toString('base64')}`, {
    public_id: invoicePublicId,
    resource_type: 'raw',
    type: 'authenticated',
    overwrite: true,
  });

  // Stored only as a marker that a document exists — not a fetchable URL.
  await prisma.paymentHistory.update({ where: { id: payment.id }, data: { invoiceUrl: invoicePublicId } });

  return { pdfBuffer, invoiceNumber, invoiceUrl: invoicePublicId, tenant, owner, payment };
}

export type RenderedInvoice = Awaited<ReturnType<typeof renderAndStoreInvoice>>;

/** Emails the rendered PDF as an attachment and logs the send to EmailLog. */
export async function emailInvoice(result: RenderedInvoice) {
  if (!result.owner?.email) {
    return { ok: false as const, status: 400, error: 'No owner email on file for this tenant' };
  }

  const email = invoiceEmail({
    ownerName: result.owner.name || 'there',
    restaurantName: result.tenant.name,
    invoiceNumber: result.invoiceNumber,
    amount: formatPKR(result.payment.amount),
    status: result.payment.status === 'PAID' ? 'PAID' : 'DUE',
    billingUrl: 'https://console.dineiz.com/settings/billing',
  });

  let status: 'SENT' | 'FAILED' = 'SENT';
  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;

  if (process.env.RESEND_API_KEY) {
    try {
      const sendResult = await resend.emails.send({
        from: 'Dineiz Billing <billing@dineiz.com>',
        to: result.owner.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [{ filename: `${result.invoiceNumber}.pdf`, content: result.pdfBuffer.toString('base64') }],
      });
      providerMessageId = sendResult.data?.id;
    } catch (sendErr: any) {
      status = 'FAILED';
      errorMessage = sendErr?.message ?? 'Send failed';
    }
  } else {
    status = 'FAILED';
    errorMessage = 'RESEND_API_KEY not configured';
  }

  await prisma.emailLog.create({
    data: {
      tenantId: result.tenant.id,
      recipientEmail: result.owner.email,
      template: 'INVOICE',
      subject: email.subject,
      status,
      providerMessageId,
      errorMessage,
      attempts: 1,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });

  if (status === 'FAILED') return { ok: false as const, status: 502, error: errorMessage };
  return { ok: true as const };
}

/** Pakistani local numbers (03XX-XXXXXXX) → wa.me's required 92XXXXXXXXXX, no plus/dashes. */
function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.startsWith('92')) return digits;
  return digits;
}

/**
 * A wa.me deep link pre-filled with a short message and a freshly-signed
 * download link — not a real attachment (WhatsApp's click-to-chat URLs can't
 * carry files), but it opens a chat with the tenant ready to send.
 */
export function buildWhatsAppShareUrl(params: {
  invoiceUrl: string;
  invoiceNumber: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  isPaid: boolean;
}): string | null {
  if (!params.ownerPhone) return null;

  const downloadUrl = cloudinary.utils.private_download_url(params.invoiceUrl, '', {
    resource_type: 'raw',
    type: 'authenticated',
    attachment: false,
  });

  const docLabel = params.isPaid ? 'receipt' : 'invoice';
  const message = `Hi ${params.ownerName || 'there'}, here's your ${docLabel} ${params.invoiceNumber} from Dineiz: ${downloadUrl}`;

  return `https://wa.me/${normalizePhoneForWhatsApp(params.ownerPhone)}?text=${encodeURIComponent(message)}`;
}
