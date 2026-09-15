import ExcelJS from 'exceljs'
import type { ReportData } from './types'

/** One worksheet per section — natural for Excel, unlike the PDF's stacked-vertically layout. */
export async function renderReportToExcel(report: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Dineiz'
  workbook.created = new Date(report.generatedAt)

  report.sections.forEach((section, index) => {
    const sheetName = (section.title ?? `Sheet${index + 1}`).slice(0, 31)
    const sheet = workbook.addWorksheet(sheetName)

    sheet.columns = section.columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: Math.max(c.label.length + 4, 14)
    }))
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B35' } }

    for (const row of section.rows) sheet.addRow(row)

    for (const col of section.columns) {
      if (col.format === 'currency' || col.format === 'number') {
        sheet.getColumn(col.key).numFmt = '#,##0'
      } else if (col.format === 'percent') {
        sheet.getColumn(col.key).numFmt = '0"%"'
      }
    }

    if (section.summaryRow) {
      sheet.addRow(section.summaryRow).font = { bold: true }
    }
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
