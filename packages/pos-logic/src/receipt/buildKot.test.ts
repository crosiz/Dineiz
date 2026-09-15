import { describe, expect, it } from 'vitest';
import { buildCancellationKotDocument, buildKotDocument } from './buildKot';
import type { PrintOrder, ReceiptDocument } from './types';

function flatten(doc: ReceiptDocument): string {
  return doc.sections
    .flatMap((s) => s.lines)
    .flatMap((l) => [l.text, ...(l.columns ?? [])])
    .filter((v): v is string => Boolean(v))
    .join(' | ');
}

const order: PrintOrder = {
  orderNumber: 'ORD-001',
  type: 'DINE_IN',
  restaurantName: 'Test Cafe',
  tableLabel: 'T4',
  items: [
    {
      name: 'Chicken Karahi',
      quantity: 2,
      unitPrice: 850,
      subtotal: 1700,
      variationName: 'Full',
      addOnNames: ['Extra Spicy'],
      notes: 'No onions',
    },
  ],
  subtotal: 1700,
  discountAmount: 0,
  taxAmount: 85,
  taxRatePercent: 5,
  total: 1785,
  createdAt: new Date('2026-01-01T12:00:00Z').toISOString(),
};

describe('buildKotDocument', () => {
  it('never includes a price-shaped value anywhere', () => {
    const text = flatten(buildKotDocument(order));
    expect(text).not.toMatch(/850|1700|1785|85\b/);
  });

  it('shows item name (uppercased), variation, add-ons, and notes', () => {
    const text = flatten(buildKotDocument(order));
    expect(text).toContain('CHICKEN KARAHI');
    expect(text).toContain('Full');
    expect(text).toContain('Extra Spicy');
    expect(text).toContain('No onions');
    expect(text).toContain('T4');
  });
});

describe('buildCancellationKotDocument', () => {
  it('never includes a price-shaped value, shows reason/cancelledBy/approvedBy', () => {
    const doc = buildCancellationKotDocument(order, order.items[0], 'Wrong item', 'Cashier A', 'Manager B');
    const text = flatten(doc);
    expect(text).not.toMatch(/850|1700|1785/);
    expect(text).toContain('Reason: Wrong item');
    expect(text).toContain('Cancelled by: Cashier A');
    expect(text).toContain('Approved by: Manager B');
  });
});
