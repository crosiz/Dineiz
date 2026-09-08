import type { IpcMain } from 'electron'
import { app } from 'electron'
import type { RoundingMethod } from '@dineiz/pos-logic'
import { getDb } from '../db'
import { updateRestaurantSettings, type UpdateRestaurantSettingsInput } from '../services/settings.service'
import { checkForUpdates } from '../updater/autoUpdate'

export interface RestaurantRow {
  id: string
  name: string
  address: string | null
  ntn: string | null
  cash_tax_rate: number
  card_tax_rate: number
  cash_tax_enabled: number
  card_tax_enabled: number
  tax_rounding_method: RoundingMethod
  void_requires_manager_approval: number
  receipt_header: string | null
  receipt_footer: string | null
  rush_hour_mode: number
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('app:ping', () => {
    return { ok: true, at: new Date().toISOString() }
  })

  ipcMain.handle('restaurant:get', () => {
    const row = getDb()
      .prepare(
        `SELECT id, name, address, ntn, cash_tax_rate, card_tax_rate, cash_tax_enabled, card_tax_enabled,
                tax_rounding_method, void_requires_manager_approval, receipt_header, receipt_footer, rush_hour_mode
         FROM restaurant LIMIT 1`
      )
      .get() as RestaurantRow | undefined

    return row ?? null
  })

  ipcMain.handle('restaurant:updateSettings', (_e, input: UpdateRestaurantSettingsInput) =>
    updateRestaurantSettings(getDb(), input)
  )

  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:checkForUpdates', () => checkForUpdates())
}
