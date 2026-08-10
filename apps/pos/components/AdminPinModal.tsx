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

  const NUMPAD = ['1','2','3','4','5','6','7','8','9','DEL','0','GO']

  return (
    // Full screen overlay
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal card — FIXED WIDTH, never narrow */}
      <div
        style={{
          width: '360px',          // FIXED width — never changes
          minWidth: '360px',       // cannot shrink
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          padding: '32px 28px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          animation: shake ? 'shake 0.5s ease' : 'none',
        }}
      >
        {/* Lock icon */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{
            width: '52px', height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,87,34,0.12)',
            border: '1.5px solid rgba(255,87,34,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--pos-primary, #FF5722)" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 style={{ color: '#1E293B', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            Manager Access
          </h2>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '6px' }}>
            Enter your 4-digit manager PIN
          </p>
        </div>

        {/* PIN dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '14px',
          margin: '24px 0',
          animation: shake ? 'shake 0.5s ease' : 'none',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: '18px', height: '18px',
              borderRadius: '50%',
              backgroundColor: i < pin.length
                ? (error ? '#EF4444' : 'var(--pos-primary, #FF5722)')
                : 'transparent',
              border: `2px solid ${i < pin.length
                ? (error ? '#EF4444' : 'var(--pos-primary, #FF5722)')
                : '#CBD5E1'}`,
              transition: 'all 0.15s ease',
              boxShadow: i < pin.length && !error
                ? '0 0 8px rgba(255,87,34,0.5)'
                : i < pin.length && error
                ? '0 0 8px rgba(239,68,68,0.5)'
                : 'none',
            }} />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p style={{ textAlign: 'center', color: '#EF4444', fontSize: '12px', marginBottom: '12px' }}>
            Incorrect PIN. Try again.
          </p>
        )}

        {/* Numpad — 3x4 grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}>
          {NUMPAD.map(key => {
            const isGo = key === 'GO'
            const isDel = key === 'DEL'
            return (
              <button
                key={key}
                onClick={() => handleKey(isDel ? 'DEL' : isGo ? '' : key)}
                disabled={isGo}  // GO is disabled — auto-submits at 4 digits
                style={{
                  height: '58px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isGo
                    ? '#F8FAFC'
                    : isDel
                    ? '#F8FAFC'
                    : '#F1F5F9',
                  color: '#1E293B',
                  fontSize: isGo ? '13px' : '20px',
                  fontWeight: isGo ? 600 : 700,
                  cursor: isGo ? 'default' : 'pointer',
                  transition: 'all 0.1s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isGo ? 0.4 : 1,
                }}
                onMouseDown={e => {
                  if (!isGo) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--pos-primary, #FF5722)'
                }}
                onMouseUp={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#F1F5F9'
                }}
                onTouchStart={e => {
                  if (!isGo) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--pos-primary, #FF5722)'
                }}
                onTouchEnd={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#F1F5F9'
                }}
              >
                {isDel ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                    <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                  </svg>
                ) : key}
              </button>
            )
          })}
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#64748B',
            fontSize: '14px',
            cursor: 'pointer',
            borderRadius: '10px',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
        >
          Cancel
        </button>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}
