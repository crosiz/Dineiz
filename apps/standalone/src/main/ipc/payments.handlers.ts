import type { IpcMain } from 'electron'
import { getDb } from '../db'
import { collectPayment, type CollectPaymentInput } from '../services/payments.service'

export function registerPaymentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('payments:collect', (_e, input: CollectPaymentInput) => collectPayment(getDb(), input))
}
