'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPosSession, getToken } from '@/lib/pos-session'
import { API_URL } from '@/lib/api';
import { Lock } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { PinPad } from '@/components/ui/PinPad';

interface AdminPinModalProps {
  onClose: () => void
  onSuccess?: (managerId?: string) => void
}

// Manager PIN gate (the Admin tab, and anything else that needs a manager to
// step in). Same dialog and keypad as every other PIN prompt; submits by
// itself once the fourth digit is in.
export function AdminPinModal({ onClose, onSuccess }: AdminPinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const router = useRouter()

  const session = getPosSession() || { branchId: '' };

  const validatePin = async (enteredPin: string) => {
    setChecking(true)
    try {
      const res = await fetch(`${API_URL}/api/pos/auth/validate-manager-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ pin: enteredPin, branchId: session.branchId }),
      })

      if (res.ok) {
        const data = await res.json()
        const managerId = data.manager?.id
        onClose()
        if (onSuccess) onSuccess(managerId)
        else router.push('/pos/admin')
        return
      }
      setError('That PIN isn’t a manager’s at this branch.')
    } catch {
      setError('Couldn’t reach the server to check the PIN.')
    } finally {
      setChecking(false)
    }
    setPin('')
  }

  return (
    <Dialog
      onClose={onClose}
      z={320}
      icon={Lock}
      title="Manager access"
      description="Enter a manager’s 4-digit PIN."
    >
      <PinPad
        value={pin}
        onChange={(v) => { setPin(v); if (v) setError('') }}
        onComplete={validatePin}
        error={!!error}
        disabled={checking}
      />
      <p className={`mt-3 min-h-5 text-center text-[13px] font-medium ${error ? 'text-danger' : 'text-ink-3'}`}>
        {error || (checking ? 'Checking…' : '')}
      </p>
    </Dialog>
  )
}
