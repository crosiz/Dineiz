import { describe, expect, it } from 'vitest';
import { computeOrderTotals, isCardMethod, resolveTaxRatePercent, type TaxConfig } from './tax';

const config: TaxConfig = { cashTaxRatePercent: 5, cardTaxRatePercent: 17 };

describe('isCardMethod', () => {
  it('treats CARD/JAZZCASH/EASYPAISA as card, CASH as not', () => {
    expect(isCardMethod('CARD')).toBe(true);
    expect(isCardMethod('JAZZCASH')).toBe(true);
    expect(isCardMethod('EASYPAISA')).toBe(true);
    expect(isCardMethod('CASH')).toBe(false);
  });
});

describe('resolveTaxRatePercent', () => {
  it('picks cash or card rate by method', () => {
    expect(resolveTaxRatePercent('CASH', config)).toBe(5);
    expect(resolveTaxRatePercent('CARD', config)).toBe(17);
  });

  it('returns 0 when the relevant tax type is disabled, regardless of rate', () => {
    expect(resolveTaxRatePercent('CASH', { ...config, cashTaxEnabled: false })).toBe(0);
    expect(resolveTaxRatePercent('CARD', { ...config, cardTaxEnabled: false })).toBe(0);
  });
});

describe('computeOrderTotals', () => {
  it('computes cash tax on the full subtotal with no discount', () => {
    const result = computeOrderTotals(1000, 0, 'CASH', config);
    expect(result).toEqual({
      subtotal: 1000,
      discountAmount: 0,
      taxableAmount: 1000,
      taxRatePercent: 5,
      taxAmount: 50,
      total: 1050,
    });
  });

  it('computes card tax at the card rate, not the cash rate', () => {
    const result = computeOrderTotals(1000, 0, 'CARD', config);
    expect(result.taxRatePercent).toBe(17);
    expect(result.taxAmount).toBe(170);
    expect(result.total).toBe(1170);
  });

  it('applies discount before tax (tax is computed on the taxable amount, not raw subtotal)', () => {
    const result = computeOrderTotals(1000, 200, 'CASH', config);
    expect(result.taxableAmount).toBe(800);
    expect(result.taxAmount).toBe(40); // 800 * 5%
    expect(result.total).toBe(840);
  });

  it('produces zero tax when the relevant tax type is disabled', () => {
    const result = computeOrderTotals(1000, 0, 'CASH', { ...config, cashTaxEnabled: false });
    expect(result.taxRatePercent).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(1000);
  });

  it('never treats a whole-percent rate as if it were already a fraction (the bug this fixes)', () => {
    // 17 means 17%, not 1700% and not 0.17%. A subtotal of 100 at 17% must be
    // exactly 17, not 0.17 (rate misread as already-decimal) and not 1700.
    const result = computeOrderTotals(100, 0, 'CARD', { cashTaxRatePercent: 5, cardTaxRatePercent: 17 });
    expect(result.taxAmount).toBe(17);
  });

  it('rounds via FLOOR when configured', () => {
    // 317 * 5% = 15.85
    const result = computeOrderTotals(317, 0, 'CASH', { ...config, roundingMethod: 'FLOOR' });
    expect(result.taxAmount).toBe(15);
  });

  it('rounds via CEIL when configured', () => {
    // 305 * 5% = 15.25 -> ROUND would give 15, CEIL must give 16
    const result = computeOrderTotals(305, 0, 'CASH', { ...config, roundingMethod: 'CEIL' });
    expect(result.taxAmount).toBe(16);
  });

  it('defaults to ROUND (half up)', () => {
    // 310 * 5% = 15.5 -> half-up rounds to 16
    const result = computeOrderTotals(310, 0, 'CASH', config);
    expect(result.taxAmount).toBe(16);
  });

  it('clamps a discount larger than the subtotal to the subtotal (never a negative taxable amount)', () => {
    const result = computeOrderTotals(500, 9999, 'CASH', config);
    expect(result.discountAmount).toBe(500);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('always returns a whole-rupee discountAmount, never a fractional one', () => {
    const result = computeOrderTotals(1000, 333, 'CASH', config); // no rounding needed here, sanity check
    expect(Number.isInteger(result.discountAmount)).toBe(true);
  });
});
