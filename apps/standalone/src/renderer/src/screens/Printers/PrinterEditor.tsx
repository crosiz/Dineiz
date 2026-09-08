import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

type Printer = Awaited<ReturnType<typeof window.dineiz.printers.list>>[number]
type Purpose = Printer['purpose']
type ConnectionType = Printer['connection_type']

interface PrinterEditorProps {
  printer: Printer | null
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function PrinterEditor({ printer, onClose, onSaved }: PrinterEditorProps) {
  const [name, setName] = useState(printer?.name ?? '')
  const [purpose, setPurpose] = useState<Purpose>(printer?.purpose ?? 'RECEIPT')
  const [connectionType, setConnectionType] = useState<ConnectionType>(printer?.connection_type ?? 'PDF_ONLY')
  const [osPrinterName, setOsPrinterName] = useState(printer?.os_printer_name ?? '')
  const [networkHost, setNetworkHost] = useState(printer?.network_host ?? '')
  const [networkPort, setNetworkPort] = useState(printer?.network_port ?? 9100)
  const [paperWidthMm, setPaperWidthMm] = useState(printer?.paper_width_mm ?? 80)
  const [isDefault, setIsDefault] = useState(Boolean(printer?.is_default))
  const [osPrinters, setOsPrinters] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (connectionType === 'WINDOWS') {
      window.dineiz.printers.listOsPrinters().then(setOsPrinters)
    }
  }, [connectionType])

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      const input = {
        name: name.trim(),
        purpose,
        connectionType,
        osPrinterName: connectionType === 'WINDOWS' ? osPrinterName : null,
        networkHost: connectionType === 'NETWORK' ? networkHost.trim() : null,
        networkPort,
        paperWidthMm,
        isDefault
      }
      if (printer) {
        await window.dineiz.printers.update({ id: printer.id, ...input })
      } else {
        await window.dineiz.printers.create(input)
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!printer) return
    try {
      await window.dineiz.printers.delete({ id: printer.id })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setConfirmingDelete(false)
    }
  }

  const canSave =
    name.trim().length > 0 &&
    (connectionType !== 'NETWORK' || networkHost.trim().length > 0) &&
    (connectionType !== 'WINDOWS' || osPrinterName.trim().length > 0)

  return (
    <>
      <Modal onClose={onClose} title={printer ? 'Edit printer' : 'New printer'}>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Name</span>
            <input
              className="h-10 w-full px-3"
              placeholder="e.g. Kitchen printer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Used for</span>
              <select
                className="h-10 w-full px-3 text-sm"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as Purpose)}
              >
                <option value="RECEIPT">Customer receipts</option>
                <option value="KITCHEN">Kitchen orders (KOT)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Connection</span>
              <select
                className="h-10 w-full px-3 text-sm"
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
              >
                <option value="PDF_ONLY">Save as PDF (no printer)</option>
                <option value="WINDOWS">Windows printer (USB)</option>
                <option value="NETWORK">Network printer (IP)</option>
              </select>
            </label>
          </div>

          {connectionType === 'WINDOWS' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">
                Windows printer name
              </span>
              {osPrinters.length > 0 ? (
                <select
                  className="h-10 w-full px-3 text-sm"
                  value={osPrinterName}
                  onChange={(e) => setOsPrinterName(e.target.value)}
                >
                  <option value="">Select a printer…</option>
                  {osPrinters.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="h-10 w-full px-3"
                  placeholder="Exact name from Windows Printers & Scanners"
                  value={osPrinterName}
                  onChange={(e) => setOsPrinterName(e.target.value)}
                />
              )}
            </label>
          )}

          {connectionType === 'NETWORK' && (
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">
                  Printer IP address
                </span>
                <input
                  className="h-10 w-full px-3"
                  placeholder="192.168.1.50"
                  value={networkHost}
                  onChange={(e) => setNetworkHost(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Port</span>
                <input
                  type="number"
                  className="h-10 w-24 px-3"
                  value={networkPort}
                  onChange={(e) => setNetworkPort(Number(e.target.value))}
                />
              </label>
            </div>
          )}

          <label className="block w-32">
            <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Paper width (mm)</span>
            <input
              type="number"
              className="h-10 w-full px-3"
              value={paperWidthMm}
              onChange={(e) => setPaperWidthMm(Number(e.target.value))}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Default printer for this purpose
          </label>

          {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

          <div className="flex gap-2 border-t border-[var(--pos-border)] pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canSave}
              className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : printer ? 'Save changes' : 'Add printer'}
            </button>
            {printer && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="h-10 rounded-xl border border-[var(--pos-red)] px-4 text-sm font-semibold text-[var(--pos-red)]"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </Modal>

      {confirmingDelete && printer && (
        <ConfirmDialog
          title="Delete printer"
          message={`Delete "${printer.name}"? This is blocked if it has any print job history.`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}
