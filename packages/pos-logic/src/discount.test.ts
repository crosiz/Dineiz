import { describe, expect, it } from 'vitest';
import { computeDiscountAmount } from './discount';

describe('computeDiscountAmount', () => {
  it('returns 0 for no discount', () => {
    expect(computeDiscountAmount(1000, null)).toBe(0);
    expect(computeDiscountAmount(1000, undefined)).toBe(0);
  });

  it('computes a fixed discount as-is', () => {
    expect(computeDiscountAmount(1000, { type: 'FIXED', value: 150 })).toBe(150);
  });

  it('computes a percent discount and rounds to a WHOLE rupee, never 2 decimal places', () => {
    // 333 * 10% = 33.3 -- must round to 33, not stay 33.3 (matches the
    // whole-rupee currency convention; the cloud POS has a bug here where it
    // rounds this branch to 2dp instead)
    const result = computeDiscountAmount(333, { type: 'PERCENT', value: 10 });
    expect(result).toBe(33);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('clamps a fixed discount larger than the subtotal', () => {
    expect(computeDiscountAmount(500, { type: 'FIXED', value: 9999 })).toBe(500);
  });

  it('clamps a percent discount over 100%', () => {
    expect(computeDiscountAmount(500, { type: 'PERCENT', value: 150 })).toBe(500);
  });

  it('never returns a negative amount', () => {
    expect(computeDiscountAmount(500, { type: 'FIXED', value: -100 })).toBe(0);
  });
});
