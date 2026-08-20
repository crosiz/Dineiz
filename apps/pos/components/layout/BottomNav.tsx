'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, UtensilsCrossed, ClipboardList, LayoutGrid, ShieldCheck, Package } from 'lucide-react'
import { useCartStore } from '@/lib/store'
import { useState, useEffect } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const NAV_ITEMS = [
  { id: 'home',    label: 'HOME',    icon: Home,            path: '/pos/home' },
  { id: 'menu',    label: 'MENU',    icon: UtensilsCrossed, path: '/pos/order' },
  { id: 'tickets', label: 'TICKETS', icon: ClipboardList,   path: '/pos/tickets' },
  { id: 'tables',  label: 'TABLES',  icon: LayoutGrid,      path: '/pos/tables' },
  { id: 'admin',   label: 'ADMIN',   icon: ShieldCheck,     path: '/pos/admin' },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const session = useCartStore(s => s.session)
  const [mounted, setMounted] = useState(false)
  const [pendingNavPath, setPendingNavPath] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      <nav className="h-16 shrink-0 flex items-center justify-around px-4 bg-white border-t border-[#E2E8F0] shadow-md relative z-40">
        {NAV_ITEMS.map(item => {
          // Role-based visibility
          if (item.id === 'admin' && !isManager) return null;
          if (isWaiter && (item.id === 'menu' || item.id === 'admin')) return null;

          let path = item.path;
          if (isWaiter && item.id === 'home') path = '/pos/tables';

          const isActive = pathname.startsWith(path.split('?')[0])
          const Icon = item.icon

          return (
            <a
              key={item.id}
              href={path}
              onClick={(e) => {
                e.preventDefault()
                const cart = useCartStore.getState().cart
                if (pathname.startsWith('/pos/order') && !path.startsWith('/pos/order') && cart.length > 0) {
                  setPendingNavPath(path)
                } else {
                  router.push(path)
                }
              }}
              className="flex flex-col items-center gap-1 min-w-[60px] py-2 transition-colors duration-150 cursor-pointer"
            >
              <Icon size={22} style={{ color: isActive ? 'var(--pos-primary, #F59E0B)' : '#64748B' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isActive ? 'var(--pos-primary, #F59E0B)' : '#64748B' }}>
                {item.label}
              </span>
            </a>
          )
        })}
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
          if (pendingNavPath) router.push(pendingNavPath)
          setPendingNavPath(null)
        }}
        onCancel={() => setPendingNavPath(null)}
      />
    </>
  )
}
