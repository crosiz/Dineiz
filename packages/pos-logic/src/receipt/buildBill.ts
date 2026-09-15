import { computeOrderTotals } from '../tax';
import { formatPKR } from '../money';
import type { DualTaxOptions, PrintOrder, ReceiptDocument, ReceiptLine, ReceiptSection } from './types';

export interface BuildBillOptions {
  isPaid: boolean;
  dualTax?: DualTaxOptions;
}

function headerSection(order: PrintOrder): ReceiptSection {
  const lines: ReceiptLine[] = [
    { kind: 'text', text: order.restaurantName, bold: true, center: true, doubleHeight: true },
  ];
  if (order.receiptHeader) lines.push({ kind: 'text', text: order.receiptHeader, center: true });
  if (order.restaurantAddress) lines.push({ kind: 'text', text: order.restaurantAddress, center: true });
  if (order.restaurantNtn) lines.push({ kind: 'text', text: `NTN: ${order.restaurantNtn}`, center: true });
  lines.push({ kind: 'separator' });
  return { name: 'header', lines };
}

function orderInfoSection(order: PrintOrder): ReceiptSection {
  const lines: ReceiptLine[] = [
    { kind: 'two-col', columns: [`Order #${order.orderNumber}`, new Date(order.createdAt).toLocaleString('en-PK')] },
    { kind: 'two-col', columns: ['Type', order.type.replace('_', ' ')] },
  ];
  if (order.tableLabel) lines.push({ kind: 'two-col', columns: ['Table', order.tableLabel] });
  if (order.cashierName) lines.push({ kind: 'two-col', columns: ['Cashier', order.cashierName] });
  lines.push({ kind: 'separator' });
  return { name: 'order-info', lines };
}

function itemsSection(order: PrintOrder): ReceiptSection {
  const lines: ReceiptLine[] = [
    { kind: 'four-col', columns: ['Qty', 'Item', 'Price', 'Amount'], bold: true },
    { kind: 'separator' },
  ];
  for (const item of order.items) {
    lines.push({
      kind: 'four-col',
      columns: [String(item.quantity), item.name, formatPKR(item.unitPrice), formatPKR(item.subtotal)],
    });
    if (item.variationName) lines.push({ kind: 'text', text: item.variationName, indent: 2 });
    for (const addOn of item.addOnNames ?? []) lines.push({ kind: 'text', text: `+ ${addOn}`, indent: 2 });
    if (item.notes) lines.push({ kind: 'text', text: `Note: ${item.notes}`, indent: 2 });
  }
  lines.push({ kind: 'separator' });
  return { name: 'items', lines };
}

function totalsBlock(
  totalLabel: string,
  subtotal: number,
  discountAmount: number,
  taxRatePercent: number,
  taxAmount: number,
  total: number,
): ReceiptLine[] {
  const lines: ReceiptLine[] = [{ kind: 'two-col', columns: ['Subtotal', formatPKR(subtotal)] }];
  if (discountAmount > 0) {
    lines.push({ kind: 'two-col', columns: ['Discount', `-${formatPKR(discountAmount)}`] });
  }
  lines.push({ kind: 'two-col', columns: [`GST (${taxRatePercent}%)`, formatPKR(taxAmount)] });
  lines.push({ kind: 'two-col', columns: [totalLabel, formatPKR(total)], bold: true, doubleHeight: true });
  return lines;
}

function totalsSection(order: PrintOrder, options: BuildBillOptions): ReceiptSection {
  const lines: ReceiptLine[] = [];

  if (!options.isPaid && options.dualTax?.enabled) {
    const dualConfig = {
      cashTaxRatePercent: options.dualTax.cashTaxRatePercent,
      cardTaxRatePercent: options.dualTax.cardTaxRatePercent,
      roundingMethod: options.dualTax.roundingMethod,
    };
    const cashTotals = computeOrderTotals(order.subtotal, order.discountAmount, 'CASH', dualConfig);
    const cardTotals = computeOrderTotals(order.subtotal, order.discountAmount, 'CARD', dualConfig);

    lines.push(
      ...totalsBlock(
        'TOTAL (ON CASH)',
        cashTotals.subtotal,
        cashTotals.discountAmount,
        cashTotals.taxRatePercent,
        cashTotals.taxAmount,
        cashTotals.total,
      ),
    );
    lines.push({ kind: 'separator' });
    lines.push(
      ...totalsBlock(
        'TOTAL (ON CARD)',
        cardTotals.subtotal,
        cardTotals.discountAmount,
        cardTotals.taxRatePercent,
        cardTotals.taxAmount,
        cardTotals.total,
      ),
    );
  } else {
    const label = options.isPaid ? 'TOTAL' : 'TOTAL DUE';
    lines.push(
      ...totalsBlock(label, order.subtotal, order.discountAmount, order.taxRatePercent, order.taxAmount, order.total),
    );
  }

  return { name: 'totals', lines };
}

function paymentSection(order: PrintOrder): ReceiptSection | null {
  if (!order.paymentMethod) return null;
  const lines: ReceiptLine[] = [{ kind: 'separator' }];
  if (order.paymentMethod === 'CASH' && order.cashTendered != null) {
    lines.push({ kind: 'two-col', columns: ['Cash Tendered', formatPKR(order.cashTendered)] });
    lines.push({ kind: 'two-col', columns: ['Change', formatPKR(order.changeGiven ?? 0)] });
  } else {
    lines.push({ kind: 'text', text: `Paid via ${order.paymentMethod}` });
  }
  return { name: 'payment', lines };
}

function footerSection(order: PrintOrder): ReceiptSection {
  const lines: ReceiptLine[] = [{ kind: 'separator' }, { kind: 'text', text: 'Thank you!', center: true }];
  if (order.notes) lines.push({ kind: 'text', text: order.notes, center: true });
  if (order.receiptFooter) lines.push({ kind: 'text', text: order.receiptFooter, center: true });
  // A small platform-branding line, same wording and placement pattern as
  // apps/pos's own receipt footer — kept as plain text (not an image) so it
  // renders identically here and on a real ESC/POS thermal printer, not just
  // in the PDF path. See pdfRenderer.ts for the small logo mark that sits
  // under this line specifically in the PDF output.
  lines.push({ kind: 'separator' });
  lines.push({ kind: 'text', text: 'Powered by Dineiz', center: true });
  return { name: 'footer', lines };
}

/**
 * The one place the isPaid/dual-tax layout decision is made — the cloud POS
 * implements this branch twice (jsPDF path, ESC/POS path) with results that
 * have drifted apart; both the PDF and ESC/POS renderers here consume this
 * same structured output instead.
 */
export function buildBillDocument(order: PrintOrder, options: BuildBillOptions): ReceiptDocument {
  const sections: ReceiptSection[] = [headerSection(order)];

  if (!options.isPaid) {
    sections.push({
      name: 'due-banner',
      lines: [
        { kind: 'text', text: '*** DUE BILL - NOT PAID ***', bold: true, center: true, invert: true },
        { kind: 'separator' },
      ],
    });
  }

  sections.push(orderInfoSection(order), itemsSection(order), totalsSection(order, options));

  const payment = paymentSection(order);
  if (payment) sections.push(payment);

  sections.push(footerSection(order));

  return { documentType: 'RECEIPT', sections, cutAfter: true };
}
