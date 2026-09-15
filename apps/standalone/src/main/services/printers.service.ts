import type Database from 'better-sqlite3'
import { newId } from '../lib/ids'
import type { ConnectionType, PrinterConfig } from '../printing/printerTransport'

export type PrinterPurpose = 'RECEIPT' | 'KITCHEN'

export interface PrinterRow {
  id: string
  name: string
  purpose: PrinterPurpose
  connection_type: ConnectionType
  os_printer_name: string | null
  network_host: string | null
  network_port: number
  paper_width_mm: number
  is_default: number
  created_at: string
}

export interface UpsertPrinterInput {
  name: string
  purpose: PrinterPurpose
  connectionType: ConnectionType
  osPrinterName?: string | null
  networkHost?: string | null
  networkPort?: number
  paperWidthMm?: number
  isDefault?: boolean
}

export function toPrinterConfig(row: PrinterRow): PrinterConfig {
  return {
    id: row.id,
    connectionType: row.connection_type,
    osPrinterName: row.os_printer_name,
    networkHost: row.network_host,
    networkPort: row.network_port,
    paperWidthMm: row.paper_width_mm
  }
}

function validate(input: UpsertPrinterInput): void {
  if (!input.name.trim()) throw new Error('Printer name is required')
  if (input.connectionType === 'NETWORK' && !input.networkHost?.trim()) {
    throw new Error('Network printers need a host/IP address')
  }
  if (input.connectionType === 'WINDOWS' && !input.osPrinterName?.trim()) {
    throw new Error('Windows printers need an OS printer name')
  }
}

export function listPrinters(db: Database.Database): PrinterRow[] {
  return db.prepare('SELECT * FROM printers ORDER BY purpose, is_default DESC, name').all() as PrinterRow[]
}

export function getDefaultPrinter(db: Database.Database, purpose: PrinterPurpose): PrinterRow | null {
  const row = db
    .prepare('SELECT * FROM printers WHERE purpose = ? AND is_default = 1 LIMIT 1')
    .get(purpose) as PrinterRow | undefined
  return row ?? null
}

export function createPrinter(db: Database.Database, input: UpsertPrinterInput): { id: string } {
  validate(input)
  const id = newId()

  db.transaction(() => {
    if (input.isDefault) {
      db.prepare('UPDATE printers SET is_default = 0 WHERE purpose = ?').run(input.purpose)
    }
    db.prepare(
      `INSERT INTO printers
         (id, name, purpose, connection_type, os_printer_name, network_host, network_port, paper_width_mm, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name.trim(),
      input.purpose,
      input.connectionType,
      input.osPrinterName ?? null,
      input.networkHost ?? null,
      input.networkPort ?? 9100,
      input.paperWidthMm ?? 80,
      input.isDefault ? 1 : 0
    )
  })()

  return { id }
}

export function updatePrinter(db: Database.Database, id: string, input: UpsertPrinterInput): void {
  validate(input)

  db.transaction(() => {
    if (input.isDefault) {
      db.prepare('UPDATE printers SET is_default = 0 WHERE purpose = ?').run(input.purpose)
    }
    db.prepare(
      `UPDATE printers SET
         name = ?, purpose = ?, connection_type = ?, os_printer_name = ?,
         network_host = ?, network_port = ?, paper_width_mm = ?, is_default = ?
       WHERE id = ?`
    ).run(
      input.name.trim(),
      input.purpose,
      input.connectionType,
      input.osPrinterName ?? null,
      input.networkHost ?? null,
      input.networkPort ?? 9100,
      input.paperWidthMm ?? 80,
      input.isDefault ? 1 : 0,
      id
    )
  })()
}

export function deletePrinter(db: Database.Database, id: string): void {
  const jobCount = db.prepare('SELECT COUNT(*) AS n FROM print_jobs WHERE printer_id = ?').get(id) as { n: number }
  if (jobCount.n > 0) {
    throw new Error('Cannot delete a printer that has print jobs in its history')
  }
  db.prepare('DELETE FROM printers WHERE id = ?').run(id)
}
