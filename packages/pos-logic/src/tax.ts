import { applyRounding, type RoundingMethod } from './money';

export type PaymentMethod = 'CASH' | 'CARD' | 'JAZZCASH' | 'EASYPAISA';

const CARD_METHODS: ReadonlySet<PaymentMethod> = new Set<PaymentMethod>(['CARD', 'JAZZCASH', 'EASYPAISA']);

export function isCardMethod(method: PaymentMethod): boolean {
  return CARD_METHODS.has(method);
}

export interface TaxConfig {
  /** Whole percent, e.g. 5 means 5%. Matches restaurant.cash_tax_rate as stored. */
  cashTaxRatePercent: number;
  /** Whole percent, e.g. 17 means 17%. Matches restaurant.card_tax_rate as stored. */
  cardTaxRatePercent: number;
  cashTaxEnabled?: boolean; // default true
  cardTaxEnabled?: boolean; // default true
  roundingMethod?: RoundingMethod; // default ROUND
}

export function resolveTaxRatePercent(method: PaymentMethod, config: TaxConfig): number {
  if (isCardMethod(method)) {
    return (config.cardTaxEnabled ?? true) ? config.cardTaxRatePercent : 0;
  }
  return (config.cashTaxEnabled ?? true) ? config.cashTaxRatePercent : 0;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  /** Whole percent actually applied — the rate the printed receipt should show. */
  taxRatePercent: number;
  taxAmount: number;
  total: number;
}

/**
 * The one canonical place tax is computed, and the only place a whole-percent
 * rate is divided by 100. Discount is always applied before tax.
 */
export function computeOrderTotals(
  subtotal: number,
  discountAmount: number,
  paymentMethod: PaymentMethod,
  config: TaxConfig,
): OrderTotals {
  const method = config.roundingMethod ?? 'ROUND';
  const clampedDiscount = applyRounding(Math.max(0, Math.min(discountAmount, subtotal)), method);
  const taxableAmount = subtotal - clampedDiscount;
  const taxRatePercent = resolveTaxRatePercent(paymentMethod, config);
  const taxAmount = applyRounding(taxableAmount * (taxRatePercent / 100), method);
  const total = taxableAmount + taxAmount;

  return { subtotal, discountAmount: clampedDiscount, taxableAmount, taxRatePercent, taxAmount, total };
}
