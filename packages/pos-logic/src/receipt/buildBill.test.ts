import { describe, expect, it } from 'vitest';
import { buildBillDocument } from './buildBill';
import type { PrintOrder, ReceiptDocument } from './types';

function flatten(doc: ReceiptDocument): string {
  return doc.sections
    .flatMap((s) => s.lines)
    .flatMap((l) => [l.text, ...(l.columns ?? [])])
    .filter((v): v is string => Boolean(v))
    .join(' | ');
}

const baseOrder: PrintOrder = {
  orderNumber: 'ORD-002',
  type: 'DINE_IN',
  restaurantName: 'Test Cafe',
  items: [{ name: 'Biryani', quantity: 1, unitPrice: 500, subtotal: 500 }],
  subtotal: 500,
  discountAmount: 0,
  taxAmount: 25,
  taxRatePercent: 5,
  total: 525,
  createdAt: new Date('2026-01-01T12:00:00Z').toISOString(),
};

describe('buildBillDocument — unpaid (due bill)', () => {
  it('shows a due banner and TOTAL DUE, single tax block when dual tax is off', () => {
    const text = flatten(buildBillDocument(baseOrder, { isPaid: false }));
    expect(text).toContain('DUE BILL');
    expect(text).toContain('TOTAL DUE');
    expect(text).not.toContain('TOTAL (ON CASH)');
    expect(text).not.toContain('TOTAL (ON CARD)');
  });

  it('shows two full independently-computed blocks when dual tax is enabled', () => {
    const text = flatten(
      buildBillDocument(baseOrder, {
        isPaid: false,
        dualTax: { enabled: true, cashTaxRatePercent: 5, cardTaxRatePercent: 17 },
      }),
    );
    expect(text).toContain('TOTAL (ON CASH)');
    expect(text).toContain('TOTAL (ON CARD)');
    expect(text).toContain('GST (5%)');
    expect(text).toContain('GST (17%)');
  });
});

describe('buildBillDocument — paid', () => {
  it('shows a single TOTAL (never TOTAL DUE or a dual block) plus payment info', () => {
    const paid: PrintOrder = { ...baseOrder, paymentMethod: 'CASH', cashTendered: 600, changeGiven: 75 };
    const text = flatten(buildBillDocument(paid, { isPaid: true }));
    expect(text).toContain('TOTAL');
    expect(text).not.toContain('TOTAL DUE');
    expect(text).not.toContain('TOTAL (ON CASH)');
    expect(text).not.toContain('DUE BILL');
    expect(text).toContain('Cash Tendered');
    expect(text).toContain('Change');
  });

  it('shows "Paid via X" instead of tendered/change for non-cash methods', () => {
    const paid: PrintOrder = { ...baseOrder, paymentMethod: 'CARD' };
    const text = flatten(buildBillDocument(paid, { isPaid: true }));
    expect(text).toContain('Paid via CARD');
    expect(text).not.toContain('Cash Tendered');
  });
});

describe('buildBillDocument — restaurant NTN, custom header/footer, and platform branding', () => {
  it('always ends with a "Powered by Dineiz" line, even with nothing else configured', () => {
    const text = flatten(buildBillDocument(baseOrder, { isPaid: true }));
    expect(text).toContain('Powered by Dineiz');
  });

  it('prints NTN and custom header/footer text when the restaurant has set them', () => {
    const withExtras: PrintOrder = {
      ...baseOrder,
      restaurantNtn: '1234567-8',
      receiptHeader: 'Welcome to Kababjees!',
      receiptFooter: 'Thank you, visit again!',
    };
    const text = flatten(buildBillDocument(withExtras, { isPaid: true }));
    expect(text).toContain('NTN: 1234567-8');
    expect(text).toContain('Welcome to Kababjees!');
    expect(text).toContain('Thank you, visit again!');
  });

  it('omits NTN/custom header/custom footer lines entirely when unset, rather than printing empty rows', () => {
    const text = flatten(buildBillDocument(baseOrder, { isPaid: true }));
    expect(text).not.toContain('NTN:');
  });
});
