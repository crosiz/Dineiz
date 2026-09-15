import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { generateReportData, type ReportRequest } from './reports.service'
import { renderReportToPdf } from './reportPdfRenderer'
import { renderReportToExcel } from './reportExcelRenderer'

export type ReportFormat = 'pdf' | 'xlsx'

function fileNameFor(request: ReportRequest, format: ReportFormat): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${request.kind.toLowerCase()}-${timestamp}.${format}`
}

export async function exportReport(
  db: Database.Database,
  request: ReportRequest,
  format: ReportFormat,
  reportsDir: string
): Promise<{ filePath: string }> {
  const data = generateReportData(db, request)
  const buffer = format === 'pdf' ? renderReportToPdf(data) : await renderReportToExcel(data)
  await mkdir(reportsDir, { recursive: true })
  const filePath = join(reportsDir, fileNameFor(request, format))
  await writeFile(filePath, buffer)
  return { filePath }
}
