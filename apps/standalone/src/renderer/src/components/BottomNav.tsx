import { ClipboardList, Home, ShieldCheck, UtensilsCrossed } from 'lucide-react'

export type NavTab = 'home' | 'order' | 'tickets' | 'admin'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
  showAdmin: boolean
}

const BASE_TABS: { key: NavTab; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'order', label: 'Order', icon: UtensilsCrossed },
  { key: 'tickets', label: 'Tickets', icon: ClipboardList }
]

export default function BottomNav({ active, onChange, showAdmin }: BottomNavProps) {
  const tabs = showAdmin ? [...BASE_TABS, { key: 'admin' as const, label: 'Admin', icon: ShieldCheck }] : BASE_TABS

  return (
    <nav className="flex h-16 shrink-0 items-center justify-around border-t border-[var(--pos-border)] bg-[var(--pos-bg-raised)]">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
            active === key ? 'text-[var(--pos-primary)]' : 'text-[var(--pos-text-muted)]'
          }`}
        >
          <Icon size={22} />
          {label}
        </button>
      ))}
    </nav>
  )
}
