'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation'
import { getPosSession, getToken } from '@/lib/pos-session'
import { API_URL } from '@/lib/api';
import { Delete, Lock } from 'lucide-react';

interface AdminPinModalProps {
  onClose: () => void
  onSuccess?: (managerId?: string) => void
}

export function AdminPinModal({ onClose, onSuccess }: AdminPinModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const router = useRouter()

  const session = getPosSession() || { branchId: '' };

  const handleKey = (key: string) => {
    if (key === 'DEL') {
      setPin(p => p.slice(0, -1))
      return
    }
    if (pin.length >= 4) return
    const newPin = pin + key
    setPin(newPin)
    if (newPin.length === 4) {
      setTimeout(() => validatePin(newPin), 200)
    }
  }

  const validatePin = async (enteredPin: string) => {
    try {
      const res = await fetch(`${API_URL}/api/pos/auth/validate-manager-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ pin: enteredPin, branchId: session.branchId }),
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const data = await res.json()
        const managerId = data.manager?.id
        // Success — navigate to admin panel
        onClose()
        if (onSuccess) onSuccess(managerId)
        else router.push('/pos/admin')
      } else {
        // Wrong PIN
        setShake(true)
        setError(true)
        setPin('')
        setTimeout(() => { setShake(false); setError(false) }, 800)
      }
    } catch {
      setShake(true)
      setError(true)
      setPin('')
      setTimeout(() => { setShake(false); setError(false) }, 800)
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace') handleKey('DEL')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pin])

  const NUMPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'GO']

  return (
    <Modal isOpen onClose={onClose} label="Manager access" zIndex={10000} className="max-w-[360px]">
      <div className={`p-5 sm:p-6 overflow-y-auto ${shake ? 'shake' : ''}`}>
        {/* Lock icon */}
        <div className="text-center mb-2">
          <div className="w-13 h-13 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center mx-auto mb-3">
            <Lock className="text-brand w-[26px] h-[26px]" />
          </div>
          <h2 className="text-ink text-[18px] font-bold clash-display">Manager Access</h2>
          <p className="text-ink-3 text-[13px] mt-1.5">Enter your 4-digit manager PIN</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3.5 my-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-[18px] h-[18px] rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? (error ? 'bg-rose-500 border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-brand border-brand shadow-[0_0_8px_rgba(245,158,11,0.5)]')
                  : 'bg-transparent border-line-strong'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-center text-rose-600 text-[12px] font-semibold mb-3">
            Incorrect PIN. Try again.
          </p>
        )}

        {/* Numpad — 3x4 grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {NUMPAD.map(key => {
            const isGo = key === 'GO'
            const isDel = key === 'DEL'
            if (isGo) return <div key={key} className="h-[58px]" />
            return (
              <button
                key={key}
                onClick={() => handleKey(isDel ? 'DEL' : key)}
                className="h-[58px] rounded-xl bg-sunken border border-line text-ink font-bold text-[20px] flex items-center justify-center hover:bg-hover active:scale-95 transition-all"
              >
                {isDel ? <Delete className="text-ink-3 w-[20px] h-[20px]" /> : key}
              </button>
            )
          })}
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-transparent text-ink-3 hover:text-ink hover:bg-sunken text-[14px] font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .shake { animation: pin-shake 0.5s ease; }
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}} />
    </Modal>
  )
}
