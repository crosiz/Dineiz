import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Socket } from 'node:net'
import { print as printPdf } from 'pdf-to-printer'
import { renderToEscPos, type ReceiptDocument } from '@dineiz/pos-logic'
import { renderReceiptToPdf } from './pdfRenderer'

export type ConnectionType = 'NETWORK' | 'WINDOWS' | 'PDF_ONLY'

export interface PrinterConfig {
  id: string
  connectionType: ConnectionType
  osPrinterName: string | null
  networkHost: string | null
  networkPort: number
  paperWidthMm: number
}

const NETWORK_TIMEOUT_MS = 8_000

/**
 * Raw ESC/POS bytes over a TCP socket (the "JetDirect"/RAW protocol most
 * network-connected thermal printers speak on port 9100) — no native
 * dependency, works on any OS. This is the path that actually exercises
 * `renderToEscPos`'s exact byte output against real hardware.
 */
function sendOverNetwork(host: string, port: number, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Timed out connecting to printer at ${host}:${port}`))
    }, NETWORK_TIMEOUT_MS)

    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    socket.connect(port, host, () => {
      socket.write(Buffer.from(bytes), (err) => {
        clearTimeout(timer)
        if (err) {
          socket.destroy()
          reject(err)
          return
        }
        socket.end()
        resolve()
      })
    })
  })
}

/**
 * Renders to PDF and hands it to the OS print spooler via pdf-to-printer
 * (MIT-licensed, zero native dependencies — bundles SumatraPDF for silent
 * printing). Works for any printer Windows already has a driver for,
 * including USB thermal printers using their vendor driver.
 */
async function sendToWindowsPrinter(osPrinterName: string, pdfBuffer: Buffer): Promise<void> {
  const tempPath = join(tmpdir(), `dineiz-print-${randomUUID()}.pdf`)
  await writeFile(tempPath, pdfBuffer)
  try {
    await printPdf(tempPath, { printer: osPrinterName, silent: true, scale: 'noscale' })
  } finally {
    await rm(tempPath, { force: true })
  }
}

/** No physical printer configured — save the rendered receipt as a PDF file instead of failing. */
async function saveAsPdfOnly(pdfBuffer: Buffer, savedPdfDir: string, fileNameHint: string): Promise<void> {
  await mkdir(savedPdfDir, { recursive: true })
  const path = join(savedPdfDir, `${fileNameHint}-${randomUUID().slice(0, 8)}.pdf`)
  await writeFile(path, pdfBuffer)
}

/**
 * Dispatches one print job to its target printer. Throws on any failure —
 * printQueue.ts is responsible for catching, recording, and retrying; this
 * function has no retry logic of its own.
 */
export async function dispatchPrintJob(
  printer: PrinterConfig,
  doc: ReceiptDocument,
  savedPdfDir: string,
  fileNameHint: string
): Promise<void> {
  if (printer.connectionType === 'NETWORK') {
    if (!printer.networkHost) throw new Error(`Printer ${printer.id} has no network host configured`)
    const bytes = renderToEscPos(doc)
    await sendOverNetwork(printer.networkHost, printer.networkPort, bytes)
    return
  }

  const pdfBuffer = renderReceiptToPdf(doc, printer.paperWidthMm)

  if (printer.connectionType === 'WINDOWS') {
    if (!printer.osPrinterName) throw new Error(`Printer ${printer.id} has no OS printer name configured`)
    await sendToWindowsPrinter(printer.osPrinterName, pdfBuffer)
    return
  }

  await saveAsPdfOnly(pdfBuffer, savedPdfDir, fileNameHint)
}
