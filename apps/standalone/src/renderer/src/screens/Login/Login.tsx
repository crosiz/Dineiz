import { useEffect, useState } from 'react'
import PinPad from '../../components/PinPad'
import DineizLogo from '../../components/DineizLogo'

type StaffSummary = Awaited<ReturnType<typeof window.dineiz.auth.listActiveStaff>>[number]

interface LoginProps {
  onLoggedIn: (user: StaffSummary) => void
}

export default function Login({ onLoggedIn }: LoginProps) {
  const [staff, setStaff] = useState<StaffSummary[] | null>(null)
  const [selected, setSelected] = useState<StaffSummary | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    window.dineiz.auth.listActiveStaff().then(setStaff)
  }, [])

  async function attemptLogin(credential: { password?: string; pin?: string }): Promise<void> {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await window.dineiz.auth.login({ userId: selected.id, ...credential })
      if (result.ok) {
        onLoggedIn(result.user)
      } else {
        setError(result.reason === 'INVALID_CREDENTIALS' ? 'Incorrect credentials' : 'Account unavailable')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!staff) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading staff…</p>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <DineizLogo height={36} />
        <h1 className="clash-display text-2xl font-bold">Who&apos;s working?</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelected(member)}
              className="role-card flex h-28 w-32 flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-bg-card)] shadow-sm"
            >
              <span className="material-symbols-outlined text-3xl text-[var(--pos-primary)]">person</span>
              <span className="text-sm font-semibold">{member.name}</span>
              <span className="text-xs text-[var(--pos-text-muted)]">{member.role}</span>
            </button>
          ))}
        </div>
        {staff.length === 0 && <p className="text-sm text-[var(--pos-text-secondary)]">No staff accounts yet.</p>}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <button
        type="button"
        onClick={() => {
          setSelected(null)
          setError(null)
          setPassword('')
        }}
        className="self-start text-sm text-[var(--pos-text-secondary)]"
      >
        ← Back
      </button>
      <h1 className="clash-display text-xl font-bold">{selected.name}</h1>

      {selected.role === 'OWNER' ? (
        <form
          className="flex w-64 flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void attemptLogin({ password })
          }}
        >
          <input
            type="password"
            autoFocus
            placeholder="Password"
            className="h-11 w-full px-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting || !password}
            className="h-11 rounded-xl bg-[var(--pos-primary)] text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? 'Checking…' : 'Log in'}
          </button>
        </form>
      ) : (
        <PinPad error={Boolean(error)} onSubmit={(pin) => void attemptLogin({ pin })} />
      )}

      {error && <p className="text-sm text-[var(--pos-red)]">{error}</p>}
    </div>
  )
}
