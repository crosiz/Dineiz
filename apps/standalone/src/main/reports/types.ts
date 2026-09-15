export type ReportColumnFormat = 'text' | 'number' | 'currency' | 'percent'

export interface ReportColumn {
  key: string
  label: string
  format?: ReportColumnFormat
}

export interface ReportSection {
  title?: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
  /** Rendered as a bold total row beneath this section's table, keyed the same as `columns`. */
  summaryRow?: Record<string, string | number>
}

export interface ReportData {
  title: string
  subtitle?: string
  generatedAt: string
  sections: ReportSection[]
}
