import { useCallback, useEffect, useState } from 'react'
import StaffEditor from './StaffEditor'
import ResetCredentialModal from './ResetCredentialModal'

type StaffMember = Awaited<ReturnType<typeof window.dineiz.staff.listAll>>[number]

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier'
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setStaff(await window.dineiz.staff.listAll())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function toggleActive(member: StaffMember): Promise<void> {
    setError(null)
    try {
      await window.dineiz.staff.setActive({ userId: member.id, isActive: !member.isActive })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!staff) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--pos-text-secondary)]">Loading staff…</p>
      </div>
    )
  }

  const resettingStaff = staff.find((s) => s.id === resettingId) ?? null

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="clash-display text-xl font-bold">Staff</h1>
        <button
          type="button"
          onClick={() => setShowEditor(true)}
          className="h-10 rounded-xl bg-[var(--pos-primary)] px-4 text-sm font-semibold text-white"
        >
          + Add staff
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--pos-red)]">{error}</p>}

      <div className="space-y-1.5">
        {staff.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border border-[var(--pos-border)] bg-[var(--pos-bg-card)] px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{member.name}</p>
              <p className="text-xs text-[var(--pos-text-muted)]">{ROLE_LABEL[member.role]}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  member.isActive
                    ? 'bg-green-50 text-[var(--pos-green)]'
                    : 'bg-[var(--pos-bg-elevated)] text-[var(--pos-text-muted)]'
                }`}
              >
                {member.isActive ? 'Active' : 'Inactive'}
              </span>
              <button
                type="button"
                onClick={() => setResettingId(member.id)}
                className="flex h-9 items-center rounded-lg border border-[var(--pos-border-strong)] px-3 text-xs font-semibold"
              >
                Reset {member.role === 'OWNER' ? 'password' : 'PIN'}
              </button>
              <button
                type="button"
                onClick={() => toggleActive(member)}
                className={`flex h-9 items-center rounded-lg border px-3 text-xs font-semibold ${
                  member.isActive
                    ? 'border-[var(--pos-red)] text-[var(--pos-red)]'
                    : 'border-[var(--pos-green)] text-[var(--pos-green)]'
                }`}
              >
                {member.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showEditor && <StaffEditor onClose={() => setShowEditor(false)} onSaved={refresh} />}
      {resettingStaff && (
        <ResetCredentialModal staff={resettingStaff} onClose={() => setResettingId(null)} onSaved={refresh} />
      )}
    </div>
  )
}
