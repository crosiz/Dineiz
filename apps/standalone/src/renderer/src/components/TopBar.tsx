import DineizLogo from './DineizLogo'

interface TopBarProps {
  restaurantName: string
  userName: string
  onLogout: () => void
}

export default function TopBar({ restaurantName, userName, onLogout }: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--pos-border)] bg-[var(--pos-bg-raised)] px-5">
      <div className="flex items-center gap-3">
        <DineizLogo height={24} />
        <div className="h-6 w-px bg-[var(--pos-border)]" />
        <p className="clash-display text-lg font-bold">{restaurantName}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--pos-text-secondary)]">{userName}</span>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-9 items-center gap-1 rounded-lg border border-[var(--pos-border-strong)] px-3 text-sm font-medium text-[var(--pos-text-secondary)]"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Log out
        </button>
      </div>
    </header>
  )
}
