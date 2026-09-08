import * as PosLogic from '@dineiz/pos-logic'

type ReportData = Awaited<ReturnType<typeof window.dineiz.reports.generate>>
type ReportColumn = ReportData['sections'][number]['columns'][number]

function formatCell(value: string | number, format: ReportColumn['format']): string {
  if (typeof value === 'string') return value
  switch (format) {
    case 'currency':
      return PosLogic.formatPKR(value)
    case 'percent':
      return `${value}%`
    case 'number':
      return value.toLocaleString()
    default:
      return String(value)
  }
}

export default function ReportViewer({ report }: { report: ReportData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="clash-display text-lg font-bold">{report.title}</h2>
        {report.subtitle && <p className="text-sm text-[var(--pos-text-secondary)]">{report.subtitle}</p>}
        <p className="text-xs text-[var(--pos-text-muted)]">
          Generated {new Date(report.generatedAt).toLocaleString('en-PK')}
        </p>
      </div>

      {report.sections.map((section, i) => (
        <div key={i}>
          {section.title && <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--pos-text-muted)]">{section.title}</h3>}
          {section.rows.length === 0 ? (
            <p className="text-sm text-[var(--pos-text-secondary)]">No data for this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--pos-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--pos-bg-elevated)] text-left">
                    {section.columns.map((c) => (
                      <th key={c.key} className="px-3 py-2 font-semibold text-[var(--pos-text-secondary)]">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-[var(--pos-border)]">
                      {section.columns.map((c) => (
                        <td key={c.key} className={`px-3 py-2 ${c.format && c.format !== 'text' ? 'font-mono' : ''}`}>
                          {formatCell(row[c.key] ?? '', c.format)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {section.summaryRow && (
                    <tr className="border-t border-[var(--pos-border-strong)] font-bold">
                      {section.columns.map((c) => (
                        <td key={c.key} className="px-3 py-2 font-mono">
                          {formatCell(section.summaryRow![c.key] ?? '', c.format)}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
