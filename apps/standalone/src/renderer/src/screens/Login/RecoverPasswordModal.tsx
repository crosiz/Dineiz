import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal'

interface RecoverPasswordModalProps {
  userId: string
  userName: string
  onClose: () => void
  onReset: () => void
}

export default function RecoverPasswordModal({ userId, userName, onClose, onReset }: RecoverPasswordModalProps) {
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await window.dineiz.auth.resetOwnerPasswordWithRecoveryCode({ userId, recoveryCode, newPassword })
      onReset()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} title={`Reset ${userName}'s password`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--pos-text-secondary)]">
          Enter the recovery code shown once during setup, and choose a new password.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Recovery code</span>
          <input
            className="h-11 w-full px-3 font-mono uppercase"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">New password</span>
          <input
            type="password"
            className="h-11 w-full px-3"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--pos-text-secondary)]">Confirm new password</span>
          <input
            type="password"
            className="h-11 w-full px-3"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !recoveryCode.trim() || newPassword.length < 6}
          className="h-11 w-full rounded-xl bg-[var(--pos-primary)] text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </Modal>
  )
}
