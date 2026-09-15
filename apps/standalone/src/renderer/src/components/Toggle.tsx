interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className={`inline-flex items-center gap-2 ${label ? 'cursor-pointer' : ''}`}>
      <span className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="absolute inset-0 rounded-full bg-[var(--pos-border-strong)] transition-colors peer-checked:bg-[var(--pos-primary)]" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
