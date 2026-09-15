import type Database from 'better-sqlite3'
import type { RoundingMethod } from '@dineiz/pos-logic'

export interface UpdateRestaurantSettingsInput {
  name: string
  address?: string | null
  ntn?: string | null
  cashTaxRatePercent: number
  cardTaxRatePercent: number
  cashTaxEnabled: boolean
  cardTaxEnabled: boolean
  taxRoundingMethod: RoundingMethod
  voidRequiresManagerApproval: boolean
  receiptHeader?: string | null
  receiptFooter?: string | null
  rushHourMode: boolean
}

/** Single-tenant schema — there is always exactly one restaurant row, so no id/WHERE is needed. */
export function updateRestaurantSettings(db: Database.Database, input: UpdateRestaurantSettingsInput): void {
  if (!input.name.trim()) throw new Error('Restaurant name is required')
  if (input.cashTaxRatePercent < 0 || input.cardTaxRatePercent < 0) throw new Error('Tax rates cannot be negative')

  db.prepare(
    `UPDATE restaurant SET
       name = ?, address = ?, ntn = ?, cash_tax_rate = ?, card_tax_rate = ?,
       cash_tax_enabled = ?, card_tax_enabled = ?, tax_rounding_method = ?,
       void_requires_manager_approval = ?, receipt_header = ?, receipt_footer = ?,
       rush_hour_mode = ?, updated_at = datetime('now')`
  ).run(
    input.name.trim(),
    input.address ?? null,
    input.ntn ?? null,
    input.cashTaxRatePercent,
    input.cardTaxRatePercent,
    input.cashTaxEnabled ? 1 : 0,
    input.cardTaxEnabled ? 1 : 0,
    input.taxRoundingMethod,
    input.voidRequiresManagerApproval ? 1 : 0,
    input.receiptHeader ?? null,
    input.receiptFooter ?? null,
    input.rushHourMode ? 1 : 0
  )
}
