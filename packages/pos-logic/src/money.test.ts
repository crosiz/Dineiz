import { describe, expect, it } from 'vitest';
import { applyRounding, formatPKR } from './money';

describe('applyRounding', () => {
  it('rounds half up by default', () => {
    expect(applyRounding(10.4)).toBe(10);
    expect(applyRounding(10.5)).toBe(11);
  });

  it('floors', () => {
    expect(applyRounding(10.9, 'FLOOR')).toBe(10);
  });

  it('ceils', () => {
    expect(applyRounding(10.1, 'CEIL')).toBe(11);
  });
});

describe('formatPKR', () => {
  it('formats whole rupees with comma grouping, no decimals, no "Rs"', () => {
    expect(formatPKR(1234)).toBe('PKR 1,234');
    expect(formatPKR(1000000)).toBe('PKR 1,000,000');
  });

  it('rounds fractional amounts so callers never need Math.round', () => {
    expect(formatPKR(1234.6)).toBe('PKR 1,235');
    expect(formatPKR(1234.4)).toBe('PKR 1,234');
  });

  it('handles zero', () => {
    expect(formatPKR(0)).toBe('PKR 0');
  });
});
