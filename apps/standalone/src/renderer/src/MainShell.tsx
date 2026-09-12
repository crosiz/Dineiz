import { useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import BottomNav, { type NavTab } from './components/BottomNav'
import ShiftGate from './screens/Shift/ShiftGate'
import HomeDashboard from './screens/Home/HomeDashboard'
import Order from './screens/Order/Order'
import Tickets from './screens/Tickets/Tickets'
import AdminShell from './screens/Admin/AdminShell'
import PaymentModal from './screens/Payment/PaymentModal'

type StaffSummary = Awaited<ReturnType<typeof window.dineiz.auth.listActiveStaff>>[number]
type Restaurant = Awaited<ReturnType<typeof window.dineiz.restaurant.get>>
type ShiftSummary = Awaited<ReturnType<typeof window.dineiz.shifts.getOpen>>
type OrderGetResult = Awaited<ReturnType<typeof window.dineiz.orders.get>>

interface MainShellProps {
  user: StaffSummary
  restaurant: Restaurant
  onLogout: () => void
}

export default function MainShell({ user, restaurant, onLogout }: MainShellProps) {
  const [shift, setShift] = useState<ShiftSummary | 'checking'>('checking')
  const [activeTab, setActiveTab] = useState<NavTab>('home')
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [payingOrder, setPayingOrder] = useState<OrderGetResult>(null)
  const [ticketsRefreshSignal, setTicketsRefreshSignal] = useState(0)

  useEffect(() => {
    window.dineiz.shifts.getOpen().then(setShift)
  }, [])

  useEffect(() => {
    if (payingOrderId) {
      window.dineiz.orders.get({ id: payingOrderId }).then(setPayingOrder)
    } else {
      setPayingOrder(null)
    }
  }, [payingOrderId])

  const isManager = user.role === 'OWNER' || user.role === 'MANAGER'

  if (shift === 'checking') {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[var(--pos-primary)]">
          progress_activity
        </span>
      </div>
    )
  }

  if (!shift) {
    return <ShiftGate cashierId={user.id} onOpened={() => window.dineiz.shifts.getOpen().then(setShift)} />
  }

  const taxConfig = {
    cashTaxRatePercent: restaurant?.cash_tax_rate ?? 5,
    cardTaxRatePercent: restaurant?.card_tax_rate ?? 17,
    cashTaxEnabled: restaurant ? Boolean(restaurant.cash_tax_enabled) : true,
    cardTaxEnabled: restaurant ? Boolean(restaurant.card_tax_enabled) : true,
    roundingMethod: restaurant?.tax_rounding_method ?? 'ROUND'
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar restaurantName={restaurant?.name ?? 'Dineiz'} userName={user.name} onLogout={onLogout} />

      <div className="min-h-0 flex-1">
        {activeTab === 'home' && (
          <HomeDashboard
            userName={user.name}
            role={user.role}
            shiftId={shift.id}
            shiftOpenedAt={shift.openedAt}
            onGoToOrder={() => setActiveTab('order')}
            onGoToTickets={() => setActiveTab('tickets')}
            onShiftClosed={() => {
              setActiveTab('home')
              window.dineiz.shifts.getOpen().then(setShift)
            }}
          />
        )}
        {activeTab === 'order' && (
          <Order
            cashierId={user.id}
            shiftId={shift.id}
            taxConfig={taxConfig}
            onOrderCreated={(orderId, action) => {
              if (action === 'charge') setPayingOrderId(orderId)
              else setActiveTab('tickets')
            }}
          />
        )}
        {activeTab === 'tickets' && (
          <Tickets
            userId={user.id}
            isManager={isManager}
            onCharge={(orderId) => setPayingOrderId(orderId)}
            refreshSignal={ticketsRefreshSignal}
          />
        )}
        {activeTab === 'admin' && isManager && <AdminShell />}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} showAdmin={isManager} />

      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          onClose={() => setPayingOrderId(null)}
          onCompleted={() => {
            setPayingOrderId(null)
            setActiveTab('tickets')
            setTicketsRefreshSignal((s) => s + 1)
          }}
        />
      )}
    </div>
  )
}
