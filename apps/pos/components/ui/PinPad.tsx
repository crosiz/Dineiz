'use client';

import { useEffect } from 'react';
import { Delete } from 'lucide-react';

// One PIN entry, used by every dialog that asks for a manager's PIN. Four
// quiet dots and a compact keypad (52px keys, well above the 44px touch
// minimum) — the old pads were 64px-tall dark boxes over 60px keys, which on
// its own made the manager-override dialog taller than a landscape tablet and
// pushed its required reason field below the fold.
//
// Physical keyboards work too (digits, Backspace), unless `keyboard` is off —
// e.g. while a text field in the same dialog has focus.

export function PinPad({
  value,
  onChange,
  length = 4,
  error = false,
  disabled = false,
  keyboard = true,
  onComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  keyboard?: boolean;
  onComplete?: (pin: string) => void;
}) {
  const press = (key: string) => {
    if (disabled) return;
    if (key === 'DEL') return onChange(value.slice(0, -1));
    if (value.length >= length) return;
    const next = value + key;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  useEffect(() => {
    if (!keyboard || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('DEL');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const key = 'h-[52px] rounded-xl bg-sunken border border-line text-ink text-[20px] font-semibold tabular-nums hover:bg-hover active:scale-[0.97] transition disabled:opacity-40';

  return (
    <div>
      <div className={`flex justify-center gap-3.5 mb-4 ${error ? 'animate-[shake_0.35s]' : ''}`} aria-label={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
              error ? 'bg-danger border-danger' : i < value.length ? 'bg-ink border-ink' : 'border-line-strong'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>{d}</button>
        ))}
        <span />
        <button type="button" className={key} onClick={() => press('0')} disabled={disabled}>0</button>
        <button type="button" className={`${key} grid place-items-center text-ink-2`} onClick={() => press('DEL')} disabled={disabled} aria-label="Delete">
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
