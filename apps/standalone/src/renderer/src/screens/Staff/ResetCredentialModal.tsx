import { useState } from 'react'
import Modal from '../../components/Modal'

type Staff = Awaited<ReturnType<typeof window.dineiz.staff.listAll>>[number]

interface ResetCredentialModalProps {
  staff: Staff
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function ResetCredentialModal({ staff, onClose, onSaved }: ResetCredentialModalProps) {
  const isOwner = staff.role === 'OWNER'
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      if (isOwner) {
        await window.dineiz.staff.changePassword({ userId: staff.id, newPassword: value })
      } else {
        await window.dineiz.staff.changePin({ userId: staff.id, newPin: value })
      }
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const canSave = isOwner ? value.length >= 6 : /^\d{4,6}$/.test(value)

  return (
    <Modal onClose={onClose} title={`Reset ${isOwner ? 'password' : 'PIN'} — ${staff.name}`}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">
            New {isOwner ? 'password' : 'PIN'}
          </span>
          <input
            type="password"
            inputMode={isOwner ? 'text' : 'numeric'}
            className="h-10 w-full px-3"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isOwner ? 'At least 6 characters' : '4-6 digits'}
            autoFocus
          />
        </label>

        {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          className="h-10 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}
