import { LOGO_URL } from './logo';

// The company issuing every invoice. Dineiz has no tax registration number
// yet and does not charge sales tax on the subscription fee itself — both of
// those are business facts, not implementation details, so they live here as
// one clearly-named place to update if either changes.
export const BILLING_ENTITY = {
  name: 'Dineiz (Pvt) Ltd',
  addressLines: ['Islamabad, Pakistan'],
  email: 'billing@dineiz.com',
  website: 'dineiz.com',
};

// Slightly larger than the email logo, but still restrained for a document
// this size — the same 280px source asset, scaled up from the email's 70px
// display width.
const INVOICE_LOGO_WIDTH = 96;
const INVOICE_LOGO_HEIGHT = 96;

export interface InvoiceLineItem {
  description: string;
  detail: string;
  amount: string;
}

export interface PlatformPaymentDetails {
  bankName?: string | null;
  bankAccountTitle?: string | null;
  bankAccountNumber?: string | null;
  bankIban?: string | null;
  jazzCashNumber?: string | null;
  jazzCashAccountTitle?: string | null;
  easypaisaNumber?: string | null;
  easypaisaAccountTitle?: string | null;
}

export interface InvoiceParams {
  invoiceNumber: string;
  status: 'PAID' | 'DUE';
  issueDate: string;
  paidDate?: string;
  billTo: {
    restaurantName: string;
    ownerName?: string;
    city?: string;
    email?: string;
  };
  billingPeriod?: string;
  paymentMethod?: string;
  paymentReference?: string;
  lineItems: InvoiceLineItem[];
  total: string;
  currency?: string;
  // Only rendered when status is DUE — how the tenant can pay this invoice.
  paymentDetails?: PlatformPaymentDetails;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const BRAND_GRADIENT = 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)';

export function buildInvoiceHtml(params: InvoiceParams): string {
  const { invoiceNumber, status, issueDate, paidDate, billTo, billingPeriod, paymentMethod, paymentReference, lineItems, total, paymentDetails } = params;

  // A document confirming money already received reads as a receipt; one
  // asking for money reads as an invoice. Same layout either way.
  const docLabel = status === 'PAID' ? 'Receipt' : 'Invoice';
  const statusColor = status === 'PAID' ? { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' } : { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };

  const metaRows: { label: string; value: string }[] = [
    { label: 'Issue date', value: issueDate },
    ...(paidDate ? [{ label: 'Payment date', value: paidDate }] : []),
    ...(billingPeriod ? [{ label: 'Billing period', value: billingPeriod }] : []),
    ...(paymentMethod ? [{ label: 'Payment method', value: paymentMethod }] : []),
    ...(paymentReference ? [{ label: 'Reference', value: paymentReference }] : []),
  ];

  const payWays: { label: string; rows: { label: string; value: string }[] }[] = [];
  if (status === 'DUE' && paymentDetails) {
    if (paymentDetails.bankAccountNumber) {
      payWays.push({
        label: 'Bank transfer',
        rows: [
          ...(paymentDetails.bankName ? [{ label: 'Bank', value: paymentDetails.bankName }] : []),
          ...(paymentDetails.bankAccountTitle ? [{ label: 'Account title', value: paymentDetails.bankAccountTitle }] : []),
          { label: 'Account number', value: paymentDetails.bankAccountNumber },
          ...(paymentDetails.bankIban ? [{ label: 'IBAN', value: paymentDetails.bankIban }] : []),
        ],
      });
    }
    if (paymentDetails.jazzCashNumber) {
      payWays.push({
        label: 'JazzCash',
        rows: [
          { label: 'Number', value: paymentDetails.jazzCashNumber },
          ...(paymentDetails.jazzCashAccountTitle ? [{ label: 'Account title', value: paymentDetails.jazzCashAccountTitle }] : []),
        ],
      });
    }
    if (paymentDetails.easypaisaNumber) {
      payWays.push({
        label: 'Easypaisa',
        rows: [
          { label: 'Number', value: paymentDetails.easypaisaNumber },
          ...(paymentDetails.easypaisaAccountTitle ? [{ label: 'Account title', value: paymentDetails.easypaisaAccountTitle }] : []),
        ],
      });
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #111827;
    background: #ffffff;
  }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 16mm 14mm; position: relative; }
  .accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${BRAND_GRADIENT}; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 6mm; margin-bottom: 12mm; }
  .header img { display: block; }
  .header-right { text-align: right; }
  .invoice-label { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: #9ca3af; text-transform: uppercase; margin: 0 0 4px; }
  .invoice-number { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .status-badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 4px 12px; border-radius: 999px; }

  .parties { display: flex; gap: 12mm; margin-bottom: 10mm; }
  .party { flex: 1; }
  .party-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; margin: 0 0 6px; }
  .party-name { font-size: 14px; font-weight: 700; color: #111827; margin: 0 0 3px; }
  .party-line { font-size: 12.5px; color: #6b7280; line-height: 1.6; margin: 0; }

  .meta-strip { display: flex; flex-wrap: wrap; gap: 0; background: #fafafa; border: 1px solid #eef0f1; border-left: 3px solid #FF6B35; border-radius: 8px; padding: 12px 18px; margin-bottom: 10mm; }
  .meta-item { flex: 1 1 30%; min-width: 130px; padding: 4px 10px 4px 0; }
  .meta-item-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 2px; }
  .meta-item-value { font-size: 12.5px; color: #111827; font-weight: 600; margin: 0; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
  table.items thead th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; font-weight: 700; padding: 0 0 8px; border-bottom: 2px solid #111827; }
  table.items thead th.amount-col { text-align: right; }
  table.items tbody td { padding: 14px 0; border-bottom: 1px solid #f0f0f1; font-size: 13px; color: #374151; vertical-align: top; }
  table.items tbody td.amount-col { text-align: right; font-weight: 600; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: nowrap; }
  .item-desc { font-weight: 600; color: #111827; margin: 0 0 3px; }
  .item-detail { font-size: 11.5px; color: #9ca3af; margin: 0; }

  .totals { display: flex; justify-content: flex-end; margin-bottom: 10mm; }
  .totals-box { width: 70mm; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #6b7280; }
  .totals-row.grand { border-top: 2px solid #111827; margin-top: 4px; padding-top: 10px; font-size: 16px; font-weight: 700; color: #111827; }
  .tax-note { font-size: 10.5px; color: #b0b3ba; text-align: right; margin: 2px 0 0; }

  .pay-section { margin-bottom: 10mm; }
  .pay-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; margin: 0 0 8px; }
  .pay-ways { display: flex; gap: 8mm; flex-wrap: wrap; }
  .pay-way { flex: 1; min-width: 55mm; background: #fafafa; border: 1px solid #eef0f1; border-radius: 8px; padding: 12px 16px; }
  .pay-way-label { font-size: 11.5px; font-weight: 700; color: #FF6B35; margin: 0 0 6px; }
  .pay-row { display: flex; justify-content: space-between; font-size: 11.5px; padding: 3px 0; }
  .pay-row-label { color: #9ca3af; }
  .pay-row-value { color: #111827; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .footer { position: absolute; bottom: 14mm; left: 16mm; right: 16mm; border-top: 1px solid #f0f0f1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
  .footer-thanks { font-size: 12px; color: #6b7280; }
  .footer-company { font-size: 10.5px; color: #b0b3ba; text-align: right; }
</style>
</head>
<body>
  <div class="page">
    <div class="accent-bar"></div>

    <div class="header">
      <img src="${LOGO_URL}" width="${INVOICE_LOGO_WIDTH}" height="${INVOICE_LOGO_HEIGHT}" alt="Dineiz">
      <div class="header-right">
        <p class="invoice-label">${docLabel}</p>
        <p class="invoice-number">${escapeHtml(invoiceNumber)}</p>
        <span class="status-badge" style="background:${statusColor.bg};color:${statusColor.text};border:1px solid ${statusColor.border};">${status === 'PAID' ? 'Paid' : 'Due'}</span>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <p class="party-label">Billed from</p>
        <p class="party-name">${escapeHtml(BILLING_ENTITY.name)}</p>
        ${BILLING_ENTITY.addressLines.map((l) => `<p class="party-line">${escapeHtml(l)}</p>`).join('')}
        <p class="party-line">${escapeHtml(BILLING_ENTITY.email)}</p>
      </div>
      <div class="party">
        <p class="party-label">Billed to</p>
        <p class="party-name">${escapeHtml(billTo.restaurantName)}</p>
        ${billTo.ownerName ? `<p class="party-line">${escapeHtml(billTo.ownerName)}</p>` : ''}
        ${billTo.city ? `<p class="party-line">${escapeHtml(billTo.city)}, Pakistan</p>` : ''}
        ${billTo.email ? `<p class="party-line">${escapeHtml(billTo.email)}</p>` : ''}
      </div>
    </div>

    <div class="meta-strip">
      ${metaRows
        .map(
          (row) => `
      <div class="meta-item">
        <p class="meta-item-label">${escapeHtml(row.label)}</p>
        <p class="meta-item-value">${escapeHtml(row.value)}</p>
      </div>`
        )
        .join('')}
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:60%;">Description</th>
          <th class="amount-col">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems
          .map(
            (item) => `
        <tr>
          <td>
            <p class="item-desc">${escapeHtml(item.description)}</p>
            <p class="item-detail">${escapeHtml(item.detail)}</p>
          </td>
          <td class="amount-col">${escapeHtml(item.amount)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row grand">
          <span>Total ${status === 'PAID' ? 'paid' : 'due'}</span>
          <span>${escapeHtml(total)}</span>
        </div>
        <p class="tax-note">No sales tax applicable.</p>
      </div>
    </div>

    ${
      payWays.length
        ? `
    <div class="pay-section">
      <p class="pay-title">How to pay</p>
      <div class="pay-ways">
        ${payWays
          .map(
            (way) => `
        <div class="pay-way">
          <p class="pay-way-label">${escapeHtml(way.label)}</p>
          ${way.rows
            .map(
              (row) => `
          <div class="pay-row">
            <span class="pay-row-label">${escapeHtml(row.label)}</span>
            <span class="pay-row-value">${escapeHtml(row.value)}</span>
          </div>`
            )
            .join('')}
        </div>`
          )
          .join('')}
      </div>
    </div>`
        : ''
    }

    <div class="footer">
      <p class="footer-thanks">${status === 'PAID' ? 'Thank you for your payment.' : `Please pay by one of the methods above. Questions? ${escapeHtml(BILLING_ENTITY.email)}.`}</p>
      <p class="footer-company">${escapeHtml(BILLING_ENTITY.name)} &middot; ${escapeHtml(BILLING_ENTITY.website)} &middot; This is a computer-generated ${docLabel.toLowerCase()}.</p>
    </div>
  </div>
</body>
</html>`;
}
