import { useState } from 'react'
import Modal from '../../components/Modal'

interface StaffEditorProps {
  onClose: () => void
  onSaved: () => Promise<void>
}

export default function StaffEditor({ onClose, onSaved }: StaffEditorProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'CASHIER' | 'MANAGER' | 'OWNER'>('CASHIER')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const needsPassword = role === 'OWNER'

  async function handleSave(): Promise<void> {
    setError(null)
    setSaving(true)
    try {
      await window.dineiz.staff.create({
        name: name.trim(),
        role,
        pin: needsPassword ? undefined : pin.trim() || undefined,
        password: needsPassword ? password : password.trim() || undefined
      })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const canSave = name.trim().length > 0 && (needsPassword ? password.length >= 6 : pin.trim().length >= 4 || password.trim().length >= 6)

  return (
    <Modal onClose={onClose} title="New staff member">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Name</span>
          <input className="h-10 w-full px-3" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Role</span>
          <select className="h-10 w-full px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="CASHIER">Cashier</option>
            <option value="MANAGER">Manager</option>
            <option value="OWNER">Owner</option>
          </select>
        </label>

        {needsPassword ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Password</span>
            <input
              type="password"
              className="h-10 w-full px-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-1 block text-xs text-[var(--pos-text-muted)]">At least 6 characters.</span>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              className="h-10 w-full px-3"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-6 digits"
            />
          </label>
        )}

        {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSave}
          className="h-10 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add staff member'}
        </button>
      </div>
    </Modal>
  )
}
