import type Database from 'better-sqlite3'
import type { ReceiptDocument } from '@dineiz/pos-logic'
import { newId } from '../lib/ids'
import { toPrinterConfig, type PrinterRow } from '../services/printers.service'
import { dispatchPrintJob } from './printerTransport'

export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'SUCCEEDED' | 'FAILED' | 'DEAD_LETTER'
export type PrintDocumentType = 'RECEIPT' | 'KOT' | 'CANCELLATION_KOT'

export interface PrintJobRow {
  id: string
  printer_id: string
  document_type: PrintDocumentType
  order_id: string | null
  payload_json: string
  status: PrintJobStatus
  attempts: number
  max_attempts: number
  next_attempt_at: string
  last_error: string | null
  created_at: string
  updated_at: string
}

/** Seconds to wait before each retry, indexed by attempt number (1-based); the last entry repeats for any further attempt. */
const BACKOFF_SCHEDULE_SECONDS = [10, 30, 120, 600]

function backoffSecondsFor(attemptNumber: number): number {
  return BACKOFF_SCHEDULE_SECONDS[Math.min(attemptNumber - 1, BACKOFF_SCHEDULE_SECONDS.length - 1)]
}

export interface EnqueuePrintJobInput {
  printerId: string
  documentType: PrintDocumentType
  orderId?: string | null
  document: ReceiptDocument
}

export function enqueuePrintJob(db: Database.Database, input: EnqueuePrintJobInput): string {
  const id = newId()
  db.prepare(
    `INSERT INTO print_jobs (id, printer_id, document_type, order_id, payload_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.printerId, input.documentType, input.orderId ?? null, JSON.stringify(input.document))
  return id
}

export interface ProcessQueueDeps {
  /** Injected so tests can supply a fake that fails N times then succeeds, without a real printer. */
  dispatch?: typeof dispatchPrintJob
  savedPdfDir: string
}

export interface ProcessQueueResult {
  succeeded: number
  failed: number
  deadLettered: number
}

/**
 * Picks up every job due for an attempt right now, dispatches each, and
 * records success/failure with exponential backoff. A single job's failure
 * never blocks the rest of the queue or throws out of this function — the
 * caller (a setInterval in the main process, or a test) just gets counts.
 */
export async function processQueueOnce(db: Database.Database, deps: ProcessQueueDeps): Promise<ProcessQueueResult> {
  const dispatch = deps.dispatch ?? dispatchPrintJob
  const dueJobs = db
    .prepare(
      `SELECT * FROM print_jobs
       WHERE status IN ('PENDING', 'FAILED') AND next_attempt_at <= datetime('now')
       ORDER BY created_at`
    )
    .all() as PrintJobRow[]

  const result: ProcessQueueResult = { succeeded: 0, failed: 0, deadLettered: 0 }

  for (const job of dueJobs) {
    db.prepare("UPDATE print_jobs SET status = 'PRINTING', updated_at = datetime('now') WHERE id = ?").run(job.id)

    try {
      const printerRow = db.prepare('SELECT * FROM printers WHERE id = ?').get(job.printer_id) as
        | PrinterRow
        | undefined
      if (!printerRow) throw new Error(`Printer ${job.printer_id} no longer exists`)

      const doc = JSON.parse(job.payload_json) as ReceiptDocument
      const fileNameHint = `${job.document_type.toLowerCase()}-${job.order_id ?? job.id}`
      await dispatch(toPrinterConfig(printerRow), doc, deps.savedPdfDir, fileNameHint)

      db.prepare("UPDATE print_jobs SET status = 'SUCCEEDED', updated_at = datetime('now') WHERE id = ?").run(job.id)
      result.succeeded += 1
    } catch (err) {
      const attempts = job.attempts + 1
      const message = err instanceof Error ? err.message : String(err)

      if (attempts >= job.max_attempts) {
        db.prepare(
          `UPDATE print_jobs SET status = 'DEAD_LETTER', attempts = ?, last_error = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(attempts, message, job.id)
        result.deadLettered += 1
      } else {
        const delaySeconds = backoffSecondsFor(attempts)
        db.prepare(
          `UPDATE print_jobs
           SET status = 'FAILED', attempts = ?, last_error = ?,
               next_attempt_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now')
           WHERE id = ?`
        ).run(attempts, message, delaySeconds, job.id)
        result.failed += 1
      }
    }
  }

  return result
}

export function listPrintJobs(db: Database.Database, status?: PrintJobStatus): PrintJobRow[] {
  if (status) {
    return db.prepare('SELECT * FROM print_jobs WHERE status = ? ORDER BY created_at DESC').all(status) as PrintJobRow[]
  }
  return db.prepare('SELECT * FROM print_jobs ORDER BY created_at DESC LIMIT 200').all() as PrintJobRow[]
}

/** Re-queues a dead-lettered job for another attempt — e.g. after the user fixes the printer's IP or turns it back on. */
export function retryDeadLetter(db: Database.Database, jobId: string): void {
  const result = db
    .prepare(
      `UPDATE print_jobs SET status = 'PENDING', attempts = 0, next_attempt_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND status = 'DEAD_LETTER'`
    )
    .run(jobId)
  if (result.changes === 0) throw new Error('Job not found or not dead-lettered')
}
