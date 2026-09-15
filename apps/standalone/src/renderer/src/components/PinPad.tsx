import { useState } from 'react'

interface PinPadProps {
  length?: number
  onSubmit: (pin: string) => void
  error?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function PinPad({ length = 4, onSubmit, error }: PinPadProps) {
  const [pin, setPin] = useState('')

  function press(digit: string): void {
    if (pin.length >= length) return
    const next = pin + digit
    setPin(next)
    if (next.length === length) {
      onSubmit(next)
      setPin('')
    }
  }

  function backspace(): void {
    setPin((p) => p.slice(0, -1))
  }

  return (
    <div className={`flex flex-col items-center gap-6 ${error ? 'shake' : ''}`}>
      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`pin-dot h-4 w-4 rounded-full border-2 ${
              i < pin.length
                ? 'border-[var(--pos-primary)] bg-[var(--pos-primary)]'
                : 'border-[var(--pos-border-strong)]'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (key === '⌫' ? backspace() : press(key))}
              className="numpad-key h-16 w-16 rounded-2xl bg-[var(--pos-bg-elevated)] text-xl font-semibold text-[var(--pos-text-primary)]"
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  )
}
