// Explicit named re-exports, deliberately not `export * from './x'`: TypeScript
// compiles a wildcard re-export to a runtime __exportStar loop in CJS output,
// which Rollup's commonjs interop can't statically analyze — every named
// import from a Vite-bundled consumer (the renderer) then fails to resolve
// even though the export genuinely exists at runtime. Explicit re-exports
// compile to statically-analyzable per-export getters instead. Keep this
// list in sync when adding a new exported symbol.

export type { RoundingMethod } from './money'
export { applyRounding, formatPKR } from './money'

export type { PaymentMethod, TaxConfig, OrderTotals } from './tax'
export { isCardMethod, resolveTaxRatePercent, computeOrderTotals } from './tax'

export type { DiscountType, Discount } from './discount'
export { computeDiscountAmount } from './discount'

export type { SelectedVariation, SelectedAddOn, CartLineInput } from './cart'
export { computeUnitPrice, computeLineSubtotal, cartLineKey, computeCartSubtotal } from './cart'

export type {
  UserRole,
  OrderStatus,
  OrderType,
  TableStatus,
  ShiftStatus,
  ShiftActivityType,
  IngredientUnit,
  StockMovementType
} from './domain'

export type {
  PrintItem,
  PrintOrder,
  DualTaxOptions,
  ReceiptLineKind,
  ReceiptLine,
  ReceiptSection,
  ReceiptDocumentType,
  ReceiptDocument
} from './receipt/types'

export { CMD, EscPosBuilder } from './receipt/escpos'
export { renderToEscPos } from './receipt/renderEscPos'
export type { PlainTextLine } from './receipt/renderPlainText'
export { PLAIN_TEXT_COLS, renderToPlainTextLines } from './receipt/renderPlainText'
export type { BuildBillOptions } from './receipt/buildBill'
export { buildBillDocument } from './receipt/buildBill'
export { buildKotDocument, buildCancellationKotDocument } from './receipt/buildKot'

export type { LicensePayload, SignedLicense } from './licensing/types'
export { canonicalizeLicensePayload } from './licensing/canonicalize'
