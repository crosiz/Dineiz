// ─── The one place an order total is worked out ────────────────────────────
//
// There used to be three, and they disagreed:
//
//   lib/store.ts  taxAmount()          respects the enabled flags, dual rate
//   lib/store.ts  combinedTaxAmount()  IGNORES the enabled flags
//   lib/core/views.ts  recalc()        IGNORES the flags AND always uses the
//                                      cash rate, reading pos_branding straight
//                                      out of localStorage at the top level only
//
// That last one is the number the outbox actually ships: `createOrderBody`
// sends `views`' taxAmount/netAmount, and `collectPaymentBody` bills its
// netAmount. So the cart could show one figure and the database receive
// another, and a tenant who had turned tax OFF still had 5% baked into every
// order. Two settings the console has always offered — `taxRoundingMethod` and
// the service charge — were read by nothing at all.
//
// Everything money-related now goes through `computeTotals`.

export type TaxRoundingMethod = 'ROUND' | 'FLOOR' | 'CEIL';

/** Payment methods taxed at the card/digital rate rather than the cash rate. */
const CARD_METHODS = new Set(['CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'ONLINE']);

export function isCardMethod(method?: string | null): boolean {
  return CARD_METHODS.has(String(method ?? 'CASH').toUpperCase());
}

/**
 * Normalised tax/charge configuration. Every rate here is a **decimal**
 * (0.05 = 5%), whatever shape it arrived in.
 */
export interface TaxConfig {
  cashTaxEnabled: boolean;
  cashTaxRate: number;
  cashTaxLabel: string;
  cashTaxNote: string | null;
  cardTaxEnabled: boolean;
  cardTaxRate: number;
  cardTaxLabel: string;
  cardTaxNote: string | null;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  serviceChargeLabel: string;
  taxRoundingMethod: TaxRoundingMethod;
  showDualTaxOnReceipt: boolean;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  cashTaxEnabled: false,
  cashTaxRate: 0.05,
  cashTaxLabel: 'GST (Cash)',
  cashTaxNote: null,
  cardTaxEnabled: false,
  cardTaxRate: 0.17,
  cardTaxLabel: 'GST (Card/Digital)',
  cardTaxNote: null,
  serviceChargeEnabled: false,
  serviceChargeRate: 0.1,
  serviceChargeLabel: 'Service Charge',
  taxRoundingMethod: 'ROUND',
  showDualTaxOnReceipt: true,
};

/**
 * Accepts a rate written either as a percent (`5`, `17`) or as a decimal
 * (`0.05`, `0.17`) and returns a decimal.
 *
 * The two shapes genuinely coexist: `pos_branding` carries percents (what the
 * console form collects) while the cart store's session carries decimals
 * (`applyBranding` divides by 100 on the way in). Anything above 1 can only be
 * a percent — a 100%+ tax rate isn't a real configuration — so this is
 * unambiguous in practice and removes a whole class of "tax came out 100×
 * wrong" bugs when a value reaches the wrong consumer.
 */
export function toDecimalRate(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n > 1 ? n / 100 : n;
}

/**
 * Read the tenant's tax setup out of a branding blob.
 *
 * `pos_branding` nests some of the Part-13 config under `.pos` and puts the
 * rest at the top level; every other consumer in the app merges them as
 * `{ ...b.pos, ...b }`, but `views.recalc()` read the top level only — so a
 * rate delivered under `branding.pos.cashTaxRate` silently fell back to a
 * hardcoded 5%. Merged here, once, for everybody.
 */
export function resolveTaxConfig(branding: Record<string, any> | null | undefined): TaxConfig {
  const b = { ...((branding as any)?.pos ?? {}), ...(branding ?? {}) } as Record<string, any>;
  const d = DEFAULT_TAX_CONFIG;

  const rounding = String(b.taxRoundingMethod ?? d.taxRoundingMethod).toUpperCase();

  return {
    cashTaxEnabled: b.cashTaxEnabled ?? d.cashTaxEnabled,
    cashTaxRate: toDecimalRate(b.cashTaxRate, d.cashTaxRate),
    cashTaxLabel: b.cashTaxLabel || d.cashTaxLabel,
    cashTaxNote: b.cashTaxNote ?? null,
    cardTaxEnabled: b.cardTaxEnabled ?? d.cardTaxEnabled,
    cardTaxRate: toDecimalRate(b.cardTaxRate, d.cardTaxRate),
    cardTaxLabel: b.cardTaxLabel || d.cardTaxLabel,
    cardTaxNote: b.cardTaxNote ?? null,
    serviceChargeEnabled: b.serviceChargeEnabled ?? d.serviceChargeEnabled,
    serviceChargeRate: toDecimalRate(b.serviceChargeRate, d.serviceChargeRate),
    serviceChargeLabel: b.serviceChargeLabel || d.serviceChargeLabel,
    taxRoundingMethod: (['ROUND', 'FLOOR', 'CEIL'].includes(rounding) ? rounding : 'ROUND') as TaxRoundingMethod,
    showDualTaxOnReceipt: b.showDualTaxOnReceipt ?? d.showDualTaxOnReceipt,
  };
}

/** Apply the tenant's configured rounding. Whole PKR only, per the currency rule. */
export function roundMoney(amount: number, method: TaxRoundingMethod = 'ROUND'): number {
  if (!Number.isFinite(amount)) return 0;
  if (method === 'FLOOR') return Math.floor(amount);
  if (method === 'CEIL') return Math.ceil(amount);
  return Math.round(amount);
}

export interface TotalsInput {
  /** Sum of line subtotals, before anything else. */
  subtotal: number;
  /** Already-resolved discount amount (not a percentage). */
  discount?: number;
  /** Which rate applies. Defaults to the cash rate. */
  method?: string | null;
  config: TaxConfig;
}

export interface Totals {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  /** What tax is charged on: subtotal − discount + service charge. */
  taxableBase: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  /** Grand total the customer pays. */
  total: number;
}

/**
 * The order of operations, stated once so no caller has to guess:
 *
 *   subtotal − discount → + service charge → tax on that → total
 *
 * Service charge sits inside the taxable base because GST in PK applies to the
 * billed amount, service charge included. Discount is capped at the subtotal so
 * a bad discount can never produce a negative bill.
 */
export function computeTotals({ subtotal, discount = 0, method, config }: TotalsInput): Totals {
  const sub = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  const disc = Math.min(Math.max(0, Number(discount) || 0), sub);
  const afterDiscount = sub - disc;

  // NOTE: `serviceChargeEnabled` is false for every tenant today, and that is
  // load-bearing until the server catches up. `apps/api`'s resolveAppliedTax
  // computes tax on the bare subtotal and `Order` has no serviceCharge column,
  // so a client that added one here would bill more than the server expects and
  // the payment would be rejected as short. Do not enable this flag before the
  // server-side half (column + resolveAppliedTax + receipts + reports) exists.
  const serviceCharge = config.serviceChargeEnabled
    ? roundMoney(afterDiscount * config.serviceChargeRate, config.taxRoundingMethod)
    : 0;

  const taxableBase = afterDiscount + serviceCharge;

  const card = isCardMethod(method);
  const taxEnabled = card ? config.cardTaxEnabled : config.cashTaxEnabled;
  const taxRate = card ? config.cardTaxRate : config.cashTaxRate;
  const taxLabel = card ? config.cardTaxLabel : config.cashTaxLabel;
  const taxAmount = taxEnabled ? roundMoney(taxableBase * taxRate, config.taxRoundingMethod) : 0;

  return {
    subtotal: sub,
    discount: disc,
    serviceCharge,
    taxableBase,
    taxRate: taxEnabled ? taxRate : 0,
    taxLabel,
    taxAmount,
    total: taxableBase + taxAmount,
  };
}

/**
 * Both sides of the pre-payment bill, which shows CASH and CARD totals so the
 * guest can choose (see the dual-tax rule in CLAUDE.md).
 */
export function computeDualTotals(input: Omit<TotalsInput, 'method'>): { cash: Totals; card: Totals } {
  return {
    cash: computeTotals({ ...input, method: 'CASH' }),
    card: computeTotals({ ...input, method: 'CARD' }),
  };
}
