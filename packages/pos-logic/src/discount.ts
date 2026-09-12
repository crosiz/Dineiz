import { applyRounding, type RoundingMethod } from './money';

export type DiscountType = 'PERCENT' | 'FIXED';

export interface Discount {
  type: DiscountType;
  value: number;
  label?: string;
}

/** Always rounds to a whole rupee, even for PERCENT — never .toFixed(2). */
export function computeDiscountAmount(
  subtotal: number,
  discount: Discount | null | undefined,
  roundingMethod: RoundingMethod = 'ROUND',
): number {
  if (!discount || discount.value <= 0) return 0;
  const raw = discount.type === 'PERCENT' ? (subtotal * discount.value) / 100 : discount.value;
  const rounded = applyRounding(raw, roundingMethod);
  return Math.max(0, Math.min(rounded, subtotal));
}
