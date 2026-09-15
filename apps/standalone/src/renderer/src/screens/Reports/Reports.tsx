import { useState } from 'react'
import ReportViewer from './ReportViewer'

type ReportRequest = Parameters<typeof window.dineiz.reports.generate>[0]
type ReportData = Awaited<ReturnType<typeof window.dineiz.reports.generate>>
type RangeKind = Exclude<ReportRequest['kind'], 'SHIFT'>

const RANGE_REPORTS: { kind: RangeKind; label: string }[] = [
  { kind: 'DAILY_SALES', label: 'Daily Sales' },
  { kind: 'TAX', label: 'Tax' },
  { kind: 'MENU_PERFORMANCE', label: 'Menu Performance' },
  { kind: 'STAFF', label: 'Staff' },
  { kind: 'VOID_DISCOUNT', label: 'Void & Discount' }
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Reports() {
  const [kind, setKind] = useState<RangeKind>('DAILY_SALES')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function currentRequest(): ReportRequest {
    return { kind, startDate, endDate }
  }

  async function handleGenerate(): Promise<void> {
    setError(null)
    setLoading(true)
    try {
      setReport(await window.dineiz.reports.generate(currentRequest()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format: 'pdf' | 'xlsx'): Promise<void> {
    setError(null)
    setExporting(true)
    try {
      const { filePath } = await window.dineiz.reports.export({ request: currentRequest(), format })
      await window.dineiz.reports.openFile({ filePath })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="clash-display mb-4 text-xl font-bold">Reports</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Report</span>
          <select
            className="h-10 px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as RangeKind)}
          >
            {RANGE_REPORTS.map((r) => (
              <option key={r.kind} value={r.kind}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">From</span>
          <input type="date" className="h-10 px-3 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">To</span>
          <input type="date" className="h-10 px-3 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
        {report && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exporting}
              className="flex h-10 items-center gap-1 rounded-xl border border-[var(--pos-border-strong)] px-3 text-xs font-semibold disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={exporting}
              className="flex h-10 items-center gap-1 rounded-xl border border-[var(--pos-border-strong)] px-3 text-xs font-semibold disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">table_view</span>
              Export Excel
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--pos-red)]">{error}</p>}

      {report && (
        <div className="mt-6">
          <ReportViewer report={report} />
        </div>
      )}
    </div>
  )
}
