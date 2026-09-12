import type { IpcMain } from 'electron'
import { app } from 'electron'
import { join } from 'node:path'
import { getPrinters as getOsPrinters } from 'pdf-to-printer'
import { buildBillDocument, buildKotDocument } from '@dineiz/pos-logic'
import { getDb } from '../db'
import {
  createPrinter,
  deletePrinter,
  listPrinters,
  updatePrinter,
  type UpsertPrinterInput
} from '../services/printers.service'
import { enqueuePrintJob, listPrintJobs, processQueueOnce, retryDeadLetter, type PrintJobStatus } from '../printing/printQueue'
import { buildPrintOrder } from '../printing/receiptData'

function savedPdfDir(): string {
  return join(app.getPath('userData'), 'receipts')
}

export function registerPrintingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('printers:list', () => listPrinters(getDb()))
  ipcMain.handle('printers:create', (_e, input: UpsertPrinterInput) => createPrinter(getDb(), input))
  ipcMain.handle('printers:update', (_e, input: { id: string } & UpsertPrinterInput) =>
    updatePrinter(getDb(), input.id, input)
  )
  ipcMain.handle('printers:delete', (_e, input: { id: string }) => deletePrinter(getDb(), input.id))
  ipcMain.handle('printers:listOsPrinters', async () => {
    try {
      const printers = await getOsPrinters()
      return printers.map((p) => p.name)
    } catch {
      // pdf-to-printer throws on non-Windows or when no printers are installed — an empty list is a fine answer either way.
      return []
    }
  })

  ipcMain.handle('printJobs:list', (_e, input?: { status?: PrintJobStatus }) => listPrintJobs(getDb(), input?.status))
  ipcMain.handle('printJobs:retry', (_e, input: { jobId: string }) => retryDeadLetter(getDb(), input.jobId))
  ipcMain.handle('printJobs:processNow', () => processQueueOnce(getDb(), { savedPdfDir: savedPdfDir() }))

  ipcMain.handle('printJobs:reprintReceipt', (_e, input: { orderId: string; printerId: string; isPaid: boolean }) => {
    const doc = buildBillDocument(buildPrintOrder(getDb(), input.orderId), { isPaid: input.isPaid })
    return enqueuePrintJob(getDb(), {
      printerId: input.printerId,
      documentType: 'RECEIPT',
      orderId: input.orderId,
      document: doc
    })
  })
  ipcMain.handle('printJobs:reprintKot', (_e, input: { orderId: string; printerId: string }) => {
    const doc = buildKotDocument(buildPrintOrder(getDb(), input.orderId))
    return enqueuePrintJob(getDb(), {
      printerId: input.printerId,
      documentType: 'KOT',
      orderId: input.orderId,
      document: doc
    })
  })
}
