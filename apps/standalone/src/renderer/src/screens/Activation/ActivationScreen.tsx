import { useEffect, useState } from 'react'
import DineizLogo from '../../components/DineizLogo'

type LicenseStatus = Awaited<ReturnType<typeof window.dineiz.licensing.getStatus>>

interface ActivationScreenProps {
  status: LicenseStatus
  onActivated: () => void
}

const REASON_MESSAGE: Record<string, string> = {
  NOT_ACTIVATED: 'This installation has not been activated yet.',
  CORRUPT_LICENSE_DATA: 'The stored license could not be read — it may have been corrupted.',
  INVALID_SIGNATURE: 'The stored license is not valid or has been tampered with.',
  EXPIRED: 'This license has expired.',
  FINGERPRINT_MISMATCH: 'This license was issued for a different computer.'
}

export default function ActivationScreen({ status, onActivated }: ActivationScreenProps) {
  const [fingerprint, setFingerprint] = useState(status.machineFingerprint)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFingerprint(status.machineFingerprint)
  }, [status.machineFingerprint])

  async function handleImport(): Promise<void> {
    setError(null)
    setImporting(true)
    try {
      const result = await window.dineiz.licensing.importAndActivate()
      if (!result) return // user cancelled the file picker
      if (result.activated) {
        onActivated()
      } else {
        setError(REASON_MESSAGE[result.reason ?? ''] ?? 'That license could not be activated.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--pos-bg-base)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] p-8 text-center shadow-sm">
        <DineizLogo height={32} className="mx-auto" />
        <h1 className="clash-display mt-4 text-2xl font-bold">Activate this installation</h1>
        <p className="mt-1 text-sm text-[var(--pos-text-secondary)]">
          {REASON_MESSAGE[status.reason ?? ''] ?? 'A valid license is required to use Dineiz.'}
        </p>

        <div className="mt-6 rounded-xl bg-[var(--pos-bg-elevated)] p-4 text-left">
          <p className="text-xs font-medium text-[var(--pos-text-secondary)]">This computer's ID</p>
          <p className="mt-1 break-all font-mono text-sm">{fingerprint}</p>
          <p className="mt-2 text-xs text-[var(--pos-text-muted)]">
            Send this ID to Dineiz to receive your license file for this computer.
          </p>
        </div>

        {error && <p className="mt-4 text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="mt-6 h-12 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-bold text-white disabled:opacity-40"
        >
          {importing ? 'Activating…' : 'Import license file'}
        </button>
      </div>
    </div>
  )
}
