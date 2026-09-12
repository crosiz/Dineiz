import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import IconButton from '../../components/IconButton'

type Backup = Awaited<ReturnType<typeof window.dineiz.backups.list>>[number]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TRIGGER_LABEL: Record<Backup['trigger_type'], string> = {
  MANUAL: 'Manual',
  HOURLY: 'Hourly',
  SHIFT_CLOSE: 'Shift close',
  DAILY: 'Daily',
  MONTHLY: 'Monthly',
  PRE_RESTORE: 'Pre-restore safety copy'
}

export default function Backups() {
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)

  const refresh = useCallback(async () => {
    setBackups(await window.dineiz.backups.list())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleCreate(): Promise<void> {
    setError(null)
    setCreating(true)
    try {
      await window.dineiz.backups.create()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingId) return
    try {
      await window.dineiz.backups.delete({ id: deletingId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeletingId(null)
    }
  }

  async function confirmRestore(): Promise<void> {
    if (!restoringId) return
    try {
      await window.dineiz.backups.restore({ id: restoringId })
      setRestored(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRestoringId(null)
    }
  }

  if (restored) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-[var(--pos-green)]">check_circle</span>
        <h2 className="clash-display text-xl font-bold">Restore complete</h2>
        <p className="text-sm text-[var(--pos-text-secondary)]">
          The database was restored. Restart Dineiz to make sure every screen picks up the restored data.
        </p>
      </div>
    )
  }

  if (!backups) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading backups…</p>
      </div>
    )
  }

  const restoringBackup = backups.find((b) => b.id === restoringId) ?? null

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="clash-display text-xl font-bold">Backups</h1>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {creating ? 'Backing up…' : '+ Back up now'}
        </button>
      </div>

      <p className="mb-4 text-sm text-[var(--pos-text-secondary)]">
        Dineiz also backs up automatically every hour, once a day, once a month, and whenever a shift closes.
      </p>

      {error && <p className="mb-3 text-sm text-[var(--pos-red)]">{error}</p>}

      {backups.length === 0 ? (
        <p className="text-sm text-[var(--pos-text-secondary)]">No backups yet.</p>
      ) : (
        <div className="space-y-1.5">
          {backups.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-[var(--pos-border)] bg-[var(--pos-bg-card)] px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {TRIGGER_LABEL[b.trigger_type]} · {new Date(b.created_at).toLocaleString('en-PK')}
                </p>
                <p className="text-xs text-[var(--pos-text-muted)]">{formatSize(b.size_bytes)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRestoringId(b.id)}
                  className="flex h-9 items-center rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold"
                >
                  Restore
                </button>
                <IconButton icon="delete" variant="danger" label="Delete backup" onClick={() => setDeletingId(b.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {deletingId && (
        <ConfirmDialog
          title="Delete backup"
          message="Delete this backup file? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {restoringBackup && (
        <ConfirmDialog
          title="Restore this backup?"
          message={`This replaces all current data with the ${TRIGGER_LABEL[restoringBackup.trigger_type].toLowerCase()} backup from ${new Date(restoringBackup.created_at).toLocaleString('en-PK')}. A safety copy of the current data is taken automatically first, so this can be undone if needed.`}
          confirmLabel="Restore"
          onConfirm={confirmRestore}
          onCancel={() => setRestoringId(null)}
        />
      )}
    </div>
  )
}
