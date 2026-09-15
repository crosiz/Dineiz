import type { ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

// Bounded flex column (max-h-[85vh], header/footer shrink-0, body
// flex-1 overflow-y-auto) — an unbounded card here clips its content under
// the header the moment it grows past the viewport.
export default function Modal({ onClose, title, children, footer }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="slide-up flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--pos-bg-card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--pos-border)] px-5 py-4">
          <h2 className="clash-display text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-[var(--pos-text-secondary)]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-[var(--pos-border)] px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
