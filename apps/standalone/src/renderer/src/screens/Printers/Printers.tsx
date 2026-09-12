import { useCallback, useEffect, useState } from 'react'
import IconButton from '../../components/IconButton'
import PrinterEditor from './PrinterEditor'

type Printer = Awaited<ReturnType<typeof window.dineiz.printers.list>>[number]
type PrintJob = Awaited<ReturnType<typeof window.dineiz.printJobs.list>>[number]

const CONNECTION_LABEL: Record<Printer['connection_type'], string> = {
  NETWORK: 'Network (IP)',
  WINDOWS: 'Windows (USB)',
  PDF_ONLY: 'Save as PDF'
}

const JOB_STATUS_COLOR: Record<PrintJob['status'], string> = {
  PENDING: 'text-[var(--pos-text-muted)] bg-[var(--pos-bg-elevated)]',
  PRINTING: 'text-[var(--pos-blue)] bg-blue-50',
  SUCCEEDED: 'text-[var(--pos-green)] bg-green-50',
  FAILED: 'text-amber-700 bg-amber-50',
  DEAD_LETTER: 'text-[var(--pos-red)] bg-red-50'
}

export default function Printers() {
  const [printers, setPrinters] = useState<Printer[] | null>(null)
  const [jobs, setJobs] = useState<PrintJob[] | null>(null)
  const [editingPrinter, setEditingPrinter] = useState<Printer | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const refresh = useCallback(async () => {
    const [printerList, jobList] = await Promise.all([window.dineiz.printers.list(), window.dineiz.printJobs.list()])
    setPrinters(printerList)
    setJobs(jobList)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleRetry(jobId: string): Promise<void> {
    try {
      await window.dineiz.printJobs.retry({ jobId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleProcessNow(): Promise<void> {
    setProcessing(true)
    try {
      await window.dineiz.printJobs.processNow()
      await refresh()
    } finally {
      setProcessing(false)
    }
  }

  if (!printers || !jobs) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading printers…</p>
      </div>
    )
  }

  const printerName = (id: string): string => printers.find((p) => p.id === id)?.name ?? 'Unknown printer'

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="clash-display text-xl font-bold">Printers</h1>
        <button
          type="button"
          onClick={() => setEditingPrinter('new')}
          className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white"
        >
          + Add printer
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--pos-red)]">{error}</p>}

      {printers.length === 0 ? (
        <p className="text-sm text-[var(--pos-text-secondary)]">
          No printers configured yet — receipts and kitchen orders will queue up until one is added.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {printers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditingPrinter(p)}
              className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-4 text-left shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold">{p.name}</p>
                {Boolean(p.is_default) && (
                  <span className="rounded-full bg-[var(--pos-primary-dim)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--pos-primary)]">
                    Default
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--pos-text-muted)]">
                {p.purpose === 'RECEIPT' ? 'Customer receipts' : 'Kitchen orders'} · {CONNECTION_LABEL[p.connection_type]}
              </p>
              {p.connection_type === 'NETWORK' && (
                <p className="mt-0.5 font-mono text-xs text-[var(--pos-text-muted)]">
                  {p.network_host}:{p.network_port}
                </p>
              )}
              {p.connection_type === 'WINDOWS' && p.os_printer_name && (
                <p className="mt-0.5 text-xs text-[var(--pos-text-muted)]">{p.os_printer_name}</p>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="clash-display text-lg font-bold">Print jobs</h2>
        <button
          type="button"
          onClick={handleProcessNow}
          disabled={processing}
          className="flex h-9 items-center gap-1 rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          {processing ? 'Processing…' : 'Process queue now'}
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--pos-text-secondary)]">Nothing has printed yet.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {jobs.slice(0, 30).map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg border border-[var(--pos-border)] bg-[var(--pos-bg-card)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {job.document_type} · {printerName(job.printer_id)}
                </p>
                {job.last_error && (
                  <p className="truncate text-xs text-[var(--pos-text-muted)]" title={job.last_error}>
                    {job.last_error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${JOB_STATUS_COLOR[job.status]}`}>
                  {job.status.replace('_', ' ')}
                </span>
                {job.status === 'DEAD_LETTER' && (
                  <IconButton icon="restart_alt" label="Retry" onClick={() => handleRetry(job.id)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingPrinter && (
        <PrinterEditor
          printer={editingPrinter === 'new' ? null : editingPrinter}
          onClose={() => setEditingPrinter(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
