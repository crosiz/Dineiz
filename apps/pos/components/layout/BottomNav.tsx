'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, UtensilsCrossed, ClipboardList, LayoutGrid, ShieldCheck, Package } from 'lucide-react'
import { useCartStore } from '@/lib/store'
import { useState, useEffect, useTransition } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { navProgress } from '@/lib/nav-progress-store'

const NAV_ITEMS = [
  { id: 'home',    label: 'Home',    icon: Home,            path: '/pos/home' },
  { id: 'menu',    label: 'Menu',    icon: UtensilsCrossed, path: '/pos/order' },
  { id: 'tickets', label: 'Tickets', icon: ClipboardList,   path: '/pos/tickets' },
  { id: 'stock',   label: 'Stock',   icon: Package,         path: '/pos/stock' },
  { id: 'tables',  label: 'Tables',  icon: LayoutGrid,      path: '/pos/tables' },
  { id: 'admin',   label: 'Admin',   icon: ShieldCheck,     path: '/pos/admin' },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const session = useCartStore(s => s.session)
  const [mounted, setMounted] = useState(false)
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null)
  const [navTarget, setNavTarget] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setMounted(true)
  }, [])

  // The tapped tab is "active" the instant it's tapped (optimistic); the real
  // pathname catching up clears it.
  useEffect(() => {
    setNavTarget(null)
  }, [pathname])

  const go = (path: string) => {
    navProgress.start()
    setNavTarget(path)
    startTransition(() => router.push(path))
  }

  // Hide bottom nav on KDS screen — kitchen staff cannot navigate
  if (pathname.includes('/pos/kds')) return null
  // Hide on login, shift open, shift close screens
  if (pathname.includes('/login') || pathname.includes('/shift')) return null

  const isManager = mounted && (session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN')
  const isWaiter = mounted && session?.role === 'WAITER'
  const isCashier = mounted && session?.role === 'CASHIER'
  const isKitchen = mounted && session?.role === 'KITCHEN_STAFF'

  if (isKitchen) return null;


  return (
    <>
      <nav className="shrink-0 bg-white border-t border-line shadow-md relative z-[var(--z-nav)] pb-safe">
        <div className="h-16 flex items-center justify-around px-1 sm:px-4">
        {NAV_ITEMS.map(item => {
          // Role-based visibility
          if (item.id === 'admin' && !isManager) return null;
          if (isWaiter && (item.id === 'menu' || item.id === 'admin')) return null;

          let path = item.path;
          if (isWaiter && item.id === 'home') path = '/pos/tables';

          const base = path.split('?')[0]
          const isActive = pathname.startsWith(base) || navTarget === path
          const Icon = item.icon
          const color = isActive ? 'var(--pos-primary, #F59E0B)' : '#64748B'

          return (
            <a
              key={item.id}
              href={path}
              onClick={(e) => {
                e.preventDefault()
                if (isActive && !navTarget) return
                const cart = useCartStore.getState().cart
                if (pathname.startsWith('/pos/order') && !path.startsWith('/pos/order') && cart.length > 0) {
                  setPendingNavPath(path)
                } else {
                  go(path)
                }
              }}
              className="flex flex-col items-center justify-center gap-1 min-w-[48px] sm:min-w-[60px] flex-1 sm:flex-none max-w-[84px] h-full transition-colors duration-150 cursor-pointer"
            >
              <Icon size={22} style={{ color }} />
              {/* 12px, normal case: the old 9-10px bold capitals were the
                  hardest text on the screen to read, on the buttons pressed
                  most. */}
              <span className={`text-[12px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`} style={{ color }}>
                {item.label}
              </span>
            </a>
          )
        })}
        </div>
      </nav>
      <ConfirmModal
        isOpen={!!pendingNavPath}
        title="Leave Order?"
        message="Items in this order haven't been sent yet and will be lost if you leave."
        confirmText="Leave Order"
        cancelText="Stay"
        variant="danger"
        onConfirm={() => {
          useCartStore.getState().clearCart()
          if (pendingNavPath) go(pendingNavPath)
          setPendingNavPath(null)
        }}
        onCancel={() => setPendingNavPath(null)}
      />
    </>
  )
}
