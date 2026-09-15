import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatPKR } from '@dineiz/pos-logic'
import type { ReportColumn, ReportColumnFormat, ReportData } from './types'

function formatCell(value: string | number, format: ReportColumnFormat | undefined): string {
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency':
      return formatPKR(value)
    case 'percent':
      return `${value}%`
    case 'number':
      return value.toLocaleString()
    default:
      return String(value)
  }
}

function toRow(columns: ReportColumn[], row: Record<string, string | number>): string[] {
  return columns.map((c) => formatCell(row[c.key] ?? '', c.format))
}

export function renderReportToPdf(report: ReportData): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 14
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(report.title, marginX, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (report.subtitle) {
    doc.text(report.subtitle, marginX, y)
    y += 5
  }
  doc.setTextColor(120)
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString('en-PK')}`, marginX, y)
  doc.setTextColor(0)
  y += 6

  for (const section of report.sections) {
    if (section.title) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(section.title, marginX, y)
      y += 6
    }

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [section.columns.map((c) => c.label)],
      body: section.rows.map((row) => toRow(section.columns, row)),
      foot: section.summaryRow ? [toRow(section.columns, section.summaryRow)] : undefined,
      theme: 'striped',
      headStyles: { fillColor: [255, 107, 53] },
      footStyles: { fillColor: [255, 251, 235], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 }
    })

    // jspdf-autotable attaches lastAutoTable to the doc instance at runtime (not in its own type defs).
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  return Buffer.from(doc.output('arraybuffer'))
}
