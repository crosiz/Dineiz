import * as PosLogic from '@dineiz/pos-logic'
import { getItemTheme } from '../lib/itemTheme'

interface MenuItemCardProps {
  name: string
  price: number
  categoryName?: string
  isAvailable: boolean
  hasOptions: boolean
  cartQuantity: number
  onClick: () => void
}

export default function MenuItemCard({
  name,
  price,
  categoryName,
  isAvailable,
  hasOptions,
  cartQuantity,
  onClick
}: MenuItemCardProps) {
  const theme = getItemTheme(name, categoryName)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isAvailable}
      className="relative flex h-[220px] flex-col overflow-hidden rounded-xl border border-[var(--pos-border)] bg-white text-left shadow-sm disabled:opacity-60 sm:h-[240px]"
    >
      <div className={`relative flex h-[55%] items-center justify-center bg-gradient-to-br ${theme.gradient}`}>
        <span className="text-5xl">{theme.emoji}</span>
        {cartQuantity > 0 && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--pos-primary)] text-xs font-bold text-white shadow">
            {cartQuantity}
          </span>
        )}
        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="-rotate-12 rounded bg-black px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Sold out
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-2.5">
        <div>
          {categoryName && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
              {categoryName}
            </p>
          )}
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--pos-text-primary)]">{name}</p>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="rounded-md bg-[var(--pos-bg-base)] px-1.5 py-0.5 font-mono text-xs font-bold text-[var(--pos-price)]">
            {PosLogic.formatPKR(price)}
          </span>
          {hasOptions && (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--pos-text-muted)]">
              Options
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
