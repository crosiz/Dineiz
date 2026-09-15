import { describe, expect, it } from 'vitest';
import { cartLineKey, computeCartSubtotal, computeLineSubtotal, computeUnitPrice } from './cart';

describe('computeUnitPrice', () => {
  it('sums base price, variation price, and all add-on prices', () => {
    const price = computeUnitPrice({
      basePrice: 500,
      variation: { id: 'v1', name: 'Full', price: 200 },
      addOns: [
        { id: 'a1', name: 'Extra Cheese', price: 50 },
        { id: 'a2', name: 'Extra Spicy', price: 0 },
      ],
    });
    expect(price).toBe(750);
  });

  it('handles no variation and no add-ons', () => {
    expect(computeUnitPrice({ basePrice: 300 })).toBe(300);
  });
});

describe('computeLineSubtotal', () => {
  it('multiplies unit price by quantity', () => {
    const subtotal = computeLineSubtotal({
      itemId: 'i1',
      name: 'Karahi',
      basePrice: 500,
      quantity: 3,
      addOns: [{ id: 'a1', name: 'Extra', price: 50 }],
    });
    expect(subtotal).toBe((500 + 50) * 3);
  });
});

describe('cartLineKey', () => {
  it('is the same for identical item+variation+add-ons regardless of add-on order (merge case)', () => {
    expect(cartLineKey('item1', 'v1', ['a1', 'a2'])).toBe(cartLineKey('item1', 'v1', ['a2', 'a1']));
  });

  it('differs when add-ons differ, unlike the cloud POS which merges these (deliberate fix)', () => {
    expect(cartLineKey('item1', 'v1', ['a1'])).not.toBe(cartLineKey('item1', 'v1', ['a2']));
    expect(cartLineKey('item1', 'v1', ['a1'])).not.toBe(cartLineKey('item1', 'v1'));
  });

  it('differs when the variation differs', () => {
    expect(cartLineKey('item1', 'v1')).not.toBe(cartLineKey('item1', 'v2'));
  });

  it('differs when the item differs', () => {
    expect(cartLineKey('item1', 'v1')).not.toBe(cartLineKey('item2', 'v1'));
  });

  it('treats no variation as a stable "base" key', () => {
    expect(cartLineKey('item1')).toBe(cartLineKey('item1', null));
    expect(cartLineKey('item1')).toBe(cartLineKey('item1', undefined));
  });
});

describe('computeCartSubtotal', () => {
  it('sums all line subtotals', () => {
    const total = computeCartSubtotal([
      { itemId: 'i1', name: 'A', basePrice: 100, quantity: 2 },
      { itemId: 'i2', name: 'B', basePrice: 50, quantity: 1 },
    ]);
    expect(total).toBe(250);
  });

  it('returns 0 for an empty cart', () => {
    expect(computeCartSubtotal([])).toBe(0);
  });
});
