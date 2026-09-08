import type { PrintItem, PrintOrder, ReceiptDocument, ReceiptLine, ReceiptSection } from './types';

function kotHeaderSection(order: PrintOrder, title: string): ReceiptSection {
  const lines: ReceiptLine[] = [
    { kind: 'text', text: title, bold: true, center: true, doubleHeight: true },
    { kind: 'two-col', columns: [`#${order.orderNumber}`, new Date(order.createdAt).toLocaleTimeString('en-PK')] },
  ];
  if (order.tableLabel) lines.push({ kind: 'text', text: `Table: ${order.tableLabel}`, bold: true });
  lines.push({ kind: 'text', text: order.type.replace('_', ' ') });
  if (order.terminalName) lines.push({ kind: 'text', text: order.terminalName });
  lines.push({ kind: 'separator' });
  return { name: 'header', lines };
}

function kotItemsSection(items: PrintItem[]): ReceiptSection {
  const lines: ReceiptLine[] = [];
  for (const item of items) {
    lines.push({
      kind: 'two-col',
      columns: [String(item.quantity), item.name.toUpperCase()],
      bold: true,
      doubleHeight: true,
    });
    if (item.variationName) lines.push({ kind: 'text', text: item.variationName, indent: 2 });
    for (const addOn of item.addOnNames ?? []) lines.push({ kind: 'text', text: `+ ${addOn}`, indent: 2 });
    if (item.notes) lines.push({ kind: 'text', text: `Note: ${item.notes}`, indent: 2, bold: true });
  }
  return { name: 'items', lines };
}

/** Never reads a price field — only quantity, item name, variation, add-ons, notes. */
export function buildKotDocument(order: PrintOrder): ReceiptDocument {
  return {
    documentType: 'KOT',
    sections: [kotHeaderSection(order, 'KITCHEN ORDER'), kotItemsSection(order.items)],
    cutAfter: true,
  };
}

export function buildCancellationKotDocument(
  order: PrintOrder,
  cancelledItem: PrintItem,
  reason: string,
  cancelledBy?: string,
  approvedBy?: string,
): ReceiptDocument {
  const lines: ReceiptLine[] = [
    { kind: 'two-col', columns: [String(cancelledItem.quantity), cancelledItem.name.toUpperCase()], bold: true },
  ];
  if (cancelledItem.variationName) lines.push({ kind: 'text', text: cancelledItem.variationName, indent: 2 });
  lines.push({ kind: 'text', text: `Reason: ${reason}` });
  if (cancelledBy) lines.push({ kind: 'text', text: `Cancelled by: ${cancelledBy}` });
  if (approvedBy) lines.push({ kind: 'text', text: `Approved by: ${approvedBy}` });

  return {
    documentType: 'CANCELLATION_KOT',
    sections: [kotHeaderSection(order, '*** CANCELLED ***'), { name: 'cancelled-item', lines }],
    cutAfter: true,
  };
}
