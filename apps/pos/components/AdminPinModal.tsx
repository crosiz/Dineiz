'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getPosSession, getToken } from '@/lib/pos-session'

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pos/auth/validate-manager-pin`, {
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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`w-[360px] min-w-[360px] max-w-[90vw] bg-white rounded-[24px] border border-[#E2E8F0] shadow-[0_30px_80px_rgba(15,23,42,0.25)] p-8 animate-slide-up ${shake ? 'shake' : ''}`}
      >
        {/* Lock icon */}
        <div className="text-center mb-2">
          <div className="w-13 h-13 rounded-full bg-[var(--pos-primary,#F59E0B)]/10 border border-[var(--pos-primary,#F59E0B)]/30 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-[var(--pos-primary,#F59E0B)] text-[26px]">lock</span>
          </div>
          <h2 className="text-[#0F172A] text-[18px] font-bold clash-display">Manager Access</h2>
          <p className="text-[#64748B] text-[13px] mt-1.5">Enter your 4-digit manager PIN</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3.5 my-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-[18px] h-[18px] rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? (error ? 'bg-rose-500 border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-[var(--pos-primary,#F59E0B)] border-[var(--pos-primary,#F59E0B)] shadow-[0_0_8px_rgba(245,158,11,0.5)]')
                  : 'bg-transparent border-[#CBD5E1]'
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
                className="h-[58px] rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] font-bold text-[20px] flex items-center justify-center hover:bg-[#E2E8F0] active:scale-95 transition-all"
              >
                {isDel ? <span className="material-symbols-outlined text-[#64748B] text-[20px]">backspace</span> : key}
              </button>
            )
          })}
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] text-[14px] font-semibold transition-colors"
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
    </div>
  )
}
