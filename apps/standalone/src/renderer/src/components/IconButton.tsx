interface IconButtonProps {
  icon: string
  onClick: () => void
  variant?: 'default' | 'danger'
  label: string
}

// Small icon-only actions (row delete, etc.) still need a real tap target —
// a bare icon glyph with no padding is a handful of px on a touchscreen.
export default function IconButton({ icon, onClick, variant = 'default', label }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        variant === 'danger'
          ? 'text-[var(--pos-red)] hover:bg-red-50'
          : 'text-[var(--pos-text-muted)] hover:bg-[var(--pos-bg-elevated)]'
      }`}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </button>
  )
}
