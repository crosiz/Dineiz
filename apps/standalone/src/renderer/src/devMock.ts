/**
 * Dev-only fake IPC bridge so screens gated on window.dineiz can be visually
 * checked by opening the Vite dev server URL directly in a browser tab (no
 * real Electron window to drive). Only installed when import.meta.env.DEV is
 * true AND no real bridge is present — dead-code-eliminated from production
 * builds since main.tsx's call site is behind that same static DEV check.
 * Grown incrementally alongside the real IPC surface, one section per phase.
 */
import * as PosLogic from '@dineiz/pos-logic'

interface MockUser {
  id: string
  name: string
  role: 'OWNER' | 'MANAGER' | 'CASHIER'
  password?: string
  pin?: string
  isActive: boolean
}

interface MockVariation {
  id: string
  name: string
  price: number
  sortOrder: number
}
interface MockAddon {
  id: string
  name: string
  price: number
  sortOrder: number
}
interface MockItem {
  id: string
  categoryId: string
  name: string
  price: number
  isAvailable: boolean
  imagePath: string | null
  sortOrder: number
  variations: MockVariation[]
  addons: MockAddon[]
}
interface MockCategory {
  id: string
  name: string
  sortOrder: number
}

type MockTableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY' | 'INACTIVE'
interface MockFloor {
  id: string
  name: string
  sortOrder: number
}
interface MockTable {
  id: string
  floorId: string
  label: string
  seats: number
  posX: number
  posY: number
  status: MockTableStatus
}

interface MockOrderItem {
  id: string
  itemId: string
  variationId: string | null
  name: string
  unitPrice: number
  quantity: number
  addons: { id: string; name: string; price: number }[]
  notes: string | null
}
interface MockOrder {
  id: string
  orderNumber: string
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  status: 'PENDING' | 'IN_KITCHEN' | 'READY' | 'COMPLETED' | 'CANCELLED'
  tableId: string | null
  tableLabel: string | null
  cashierId: string
  shiftId: string
  paymentMethod: 'CASH' | 'CARD' | 'JAZZCASH' | 'EASYPAISA' | null
  subtotal: number
  taxRatePercent: number
  taxAmount: number
  discountAmount: number
  total: number
  notes: string | null
  createdAt: string
  items: MockOrderItem[]
}

interface MockShiftActivity {
  id: string
  shiftId: string
  type: 'BREAK_START' | 'BREAK_END' | 'CASH_IN' | 'CASH_OUT'
  amount: number | null
  note: string | null
  createdAt: string
}

interface MockPrinter {
  id: string
  name: string
  purpose: 'RECEIPT' | 'KITCHEN'
  connection_type: 'NETWORK' | 'WINDOWS' | 'PDF_ONLY'
  os_printer_name: string | null
  network_host: string | null
  network_port: number
  paper_width_mm: number
  is_default: number
  created_at: string
}
interface MockPrintJob {
  id: string
  printer_id: string
  document_type: 'RECEIPT' | 'KOT' | 'CANCELLATION_KOT'
  order_id: string | null
  payload_json: string
  status: 'PENDING' | 'PRINTING' | 'SUCCEEDED' | 'FAILED' | 'DEAD_LETTER'
  attempts: number
  max_attempts: number
  next_attempt_at: string
  last_error: string | null
  created_at: string
  updated_at: string
}

interface MockBackup {
  id: string
  file_path: string
  trigger_type: 'MANUAL' | 'HOURLY' | 'SHIFT_CLOSE' | 'DAILY' | 'MONTHLY' | 'PRE_RESTORE'
  size_bytes: number
  created_at: string
}

let restaurant: {
  id: string
  name: string
  address: string | null
  ntn: string | null
  cash_tax_rate: number
  card_tax_rate: number
  cash_tax_enabled: number
  card_tax_enabled: number
  tax_rounding_method: PosLogic.RoundingMethod
  void_requires_manager_approval: number
  receipt_header: string | null
  receipt_footer: string | null
  rush_hour_mode: number
} | null = null

const users: MockUser[] = []
const categories: MockCategory[] = []
const floors: MockFloor[] = []
const mockTables: MockTable[] = []
const items: MockItem[] = []
const orders: MockOrder[] = []
const printers: MockPrinter[] = []
const printJobs: MockPrintJob[] = []
const shiftActivities: MockShiftActivity[] = []
const backups: MockBackup[] = []
const MOCK_FINGERPRINT = 'DEV-MOCK-FINGERPRINT-1234'
let mockActivated = false
let openShift: { id: string; cashierId: string; cashierName: string; status: 'OPEN'; openingFloat: number; openedAt: string } | null =
  null
let nextId = 1
let orderCounter = 0
const mockId = (): string => `mock-${nextId++}`

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150))
}

function taxConfig(): PosLogic.TaxConfig {
  return {
    cashTaxRatePercent: restaurant?.cash_tax_rate ?? 5,
    cardTaxRatePercent: restaurant?.card_tax_rate ?? 17,
    cashTaxEnabled: Boolean(restaurant?.cash_tax_enabled ?? 1),
    cardTaxEnabled: Boolean(restaurant?.card_tax_enabled ?? 1),
    roundingMethod: restaurant?.tax_rounding_method ?? 'ROUND'
  }
}

export function installDevMock(): void {
  window.dineiz = {
    app: {
      ping: () => delay({ ok: true, at: new Date().toISOString() }),
      getVersion: () => delay('0.1.0-dev'),
      checkForUpdates: () => delay({ status: 'not-configured' as const })
    },
    restaurant: {
      get: () => delay(restaurant),
      updateSettings: (input) => {
        if (restaurant) {
          restaurant.name = input.name
          restaurant.address = input.address ?? null
          restaurant.ntn = input.ntn ?? null
          restaurant.cash_tax_rate = input.cashTaxRatePercent
          restaurant.card_tax_rate = input.cardTaxRatePercent
          restaurant.cash_tax_enabled = input.cashTaxEnabled ? 1 : 0
          restaurant.card_tax_enabled = input.cardTaxEnabled ? 1 : 0
          restaurant.tax_rounding_method = input.taxRoundingMethod
          restaurant.void_requires_manager_approval = input.voidRequiresManagerApproval ? 1 : 0
          restaurant.receipt_header = input.receiptHeader ?? null
          restaurant.receipt_footer = input.receiptFooter ?? null
          restaurant.rush_hour_mode = input.rushHourMode ? 1 : 0
        }
        return delay(undefined)
      }
    },
    setup: {
      getStatus: () => delay({ isComplete: restaurant !== null }),
      complete: (input) => {
        restaurant = {
          id: 'mock-restaurant',
          name: input.restaurantName,
          address: input.address ?? null,
          ntn: input.ntn ?? null,
          cash_tax_rate: input.cashTaxRatePercent,
          card_tax_rate: input.cardTaxRatePercent,
          cash_tax_enabled: 1,
          card_tax_enabled: 1,
          tax_rounding_method: 'ROUND',
          void_requires_manager_approval: 0,
          receipt_header: null,
          receipt_footer: null,
          rush_hour_mode: 0
        }
        users.push({ id: 'mock-owner', name: input.ownerName, role: 'OWNER', password: input.ownerPassword, isActive: true })
        users.push({ id: 'mock-cashier', name: 'Demo Cashier', role: 'CASHIER', pin: '1234', isActive: true })
        floors.push({ id: 'mock-floor-main', name: 'Main Floor', sortOrder: 0 })
        return delay({ restaurantId: 'mock-restaurant', ownerId: 'mock-owner' })
      }
    },
    auth: {
      listActiveStaff: () =>
        delay(
          users
            .filter((u) => u.isActive)
            .map(({ id, name, role }) => ({ id, name, role, isActive: true as const }))
        ),
      login: (input) => {
        const user = users.find((u) => u.id === input.userId)
        if (!user) return delay({ ok: false as const, reason: 'NOT_FOUND' as const })
        if (!user.isActive) return delay({ ok: false as const, reason: 'INACTIVE' as const })
        const credentialOk = input.password != null ? user.password === input.password : user.pin === input.pin
        if (!credentialOk) return delay({ ok: false as const, reason: 'INVALID_CREDENTIALS' as const })
        return delay({ ok: true as const, user: { id: user.id, name: user.name, role: user.role, isActive: true } })
      }
    },
    staff: {
      listAll: () => delay(users.map(({ id, name, role, isActive }) => ({ id, name, role, isActive }))),
      create: (input) => {
        const id = mockId()
        users.push({
          id,
          name: input.name,
          role: input.role,
          password: input.password,
          pin: input.pin,
          isActive: true
        })
        return delay({ id, name: input.name, role: input.role, isActive: true })
      },
      setActive: (input) => {
        const user = users.find((u) => u.id === input.userId)
        if (user) user.isActive = input.isActive
        return delay(undefined)
      },
      changePassword: (input) => {
        const user = users.find((u) => u.id === input.userId)
        if (user) user.password = input.newPassword
        return delay(undefined)
      },
      changePin: (input) => {
        const user = users.find((u) => u.id === input.userId)
        if (user) user.pin = input.newPin
        return delay(undefined)
      }
    },
    menu: {
      getAll: () =>
        delay({
          categories: categories
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id) }))
        }),
      createCategory: (input) => {
        const id = mockId()
        categories.push({ id, name: input.name, sortOrder: input.sortOrder ?? categories.length })
        return delay({ id })
      },
      updateCategory: (input) => {
        const category = categories.find((c) => c.id === input.id)
        if (category) {
          if (input.name !== undefined) category.name = input.name
          if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder
        }
        return delay(undefined)
      },
      deleteCategory: (input) => {
        const index = categories.findIndex((c) => c.id === input.id)
        if (index >= 0) categories.splice(index, 1)
        return delay(undefined)
      },
      reorderCategories: (input) => {
        input.orderedIds.forEach((id, index) => {
          const category = categories.find((c) => c.id === id)
          if (category) category.sortOrder = index
        })
        return delay(undefined)
      },
      createItem: (input) => {
        const id = mockId()
        items.push({
          id,
          categoryId: input.categoryId,
          name: input.name,
          price: input.price,
          isAvailable: true,
          imagePath: input.imagePath ?? null,
          sortOrder: input.sortOrder ?? items.filter((i) => i.categoryId === input.categoryId).length,
          variations: [],
          addons: []
        })
        return delay({ id })
      },
      updateItem: (input) => {
        const item = items.find((i) => i.id === input.id)
        if (item) {
          if (input.name !== undefined) item.name = input.name
          if (input.price !== undefined) item.price = input.price
          if (input.categoryId !== undefined) item.categoryId = input.categoryId
        }
        return delay(undefined)
      },
      setItemAvailability: (input) => {
        const item = items.find((i) => i.id === input.id)
        if (item) item.isAvailable = input.isAvailable
        return delay(undefined)
      },
      deleteItem: (input) => {
        const index = items.findIndex((i) => i.id === input.id)
        if (index >= 0) items.splice(index, 1)
        return delay(undefined)
      },
      createVariation: (input) => {
        const item = items.find((i) => i.id === input.itemId)
        const id = mockId()
        if (item) item.variations.push({ id, name: input.name, price: input.price, sortOrder: item.variations.length })
        return delay({ id })
      },
      updateVariation: (input) => {
        for (const item of items) {
          const variation = item.variations.find((v) => v.id === input.id)
          if (variation) {
            if (input.name !== undefined) variation.name = input.name
            if (input.price !== undefined) variation.price = input.price
          }
        }
        return delay(undefined)
      },
      deleteVariation: (input) => {
        for (const item of items) {
          item.variations = item.variations.filter((v) => v.id !== input.id)
        }
        return delay(undefined)
      },
      createAddon: (input) => {
        const item = items.find((i) => i.id === input.itemId)
        const id = mockId()
        if (item) item.addons.push({ id, name: input.name, price: input.price, sortOrder: item.addons.length })
        return delay({ id })
      },
      updateAddon: (input) => {
        for (const item of items) {
          const addon = item.addons.find((a) => a.id === input.id)
          if (addon) {
            if (input.name !== undefined) addon.name = input.name
            if (input.price !== undefined) addon.price = input.price
          }
        }
        return delay(undefined)
      },
      deleteAddon: (input) => {
        for (const item of items) {
          item.addons = item.addons.filter((a) => a.id !== input.id)
        }
        return delay(undefined)
      }
    },
    tables: {
      getAll: () =>
        delay({
          floors: floors.map((f) => ({
            id: f.id,
            name: f.name,
            sortOrder: f.sortOrder,
            tables: mockTables
              .filter((t) => t.floorId === f.id)
              .map((t) => ({ id: t.id, floorId: t.floorId, label: t.label, seats: t.seats, posX: t.posX, posY: t.posY, status: t.status }))
          }))
        }),
      createFloor: (input) => {
        const id = mockId()
        floors.push({ id, name: input.name, sortOrder: input.sortOrder ?? floors.length })
        return delay({ id })
      },
      renameFloor: (input) => {
        const floor = floors.find((f) => f.id === input.id)
        if (floor) floor.name = input.name
        return delay(undefined)
      },
      deleteFloor: (input) => {
        if (mockTables.some((t) => t.floorId === input.id)) {
          throw new Error('Cannot delete a floor that still has tables. Move or delete its tables first.')
        }
        const index = floors.findIndex((f) => f.id === input.id)
        if (index >= 0) floors.splice(index, 1)
        return delay(undefined)
      },
      createTable: (input) => {
        const label = input.label.trim()
        if (mockTables.some((t) => t.floorId === input.floorId && t.label === label)) {
          throw new Error(`A table named "${label}" already exists on this floor`)
        }
        const id = mockId()
        mockTables.push({
          id,
          floorId: input.floorId,
          label,
          seats: input.seats ?? 2,
          posX: input.posX ?? 0,
          posY: input.posY ?? 0,
          status: 'FREE'
        })
        return delay({ id })
      },
      updateTable: (input) => {
        const table = mockTables.find((t) => t.id === input.id)
        if (!table) throw new Error('Table not found')
        if (input.label !== undefined) table.label = input.label
        if (input.seats !== undefined) table.seats = input.seats
        if (input.posX !== undefined) table.posX = input.posX
        if (input.posY !== undefined) table.posY = input.posY
        return delay(undefined)
      },
      setStatus: (input) => {
        const table = mockTables.find((t) => t.id === input.id)
        if (table) table.status = input.status
        return delay(undefined)
      },
      deleteTable: (input) => {
        const table = mockTables.find((t) => t.id === input.id)
        if (!table) throw new Error('Table not found')
        if (table.status === 'OCCUPIED') throw new Error('Cannot delete a table that is currently occupied')
        if (orders.some((o) => o.tableId === input.id)) {
          throw new Error('Cannot delete a table that has order history. Mark it inactive instead.')
        }
        const index = mockTables.findIndex((t) => t.id === input.id)
        mockTables.splice(index, 1)
        return delay(undefined)
      }
    },
    shifts: {
      getOpen: () => delay(openShift),
      open: (input) => {
        if (openShift) throw new Error('A shift is already open')
        const cashier = users.find((u) => u.id === input.cashierId)
        openShift = {
          id: mockId(),
          cashierId: input.cashierId,
          cashierName: cashier?.name ?? 'Unknown',
          status: 'OPEN',
          openingFloat: input.openingFloat,
          openedAt: new Date().toISOString()
        }
        return delay(openShift)
      },
      recordActivity: (input) => {
        if (!openShift || openShift.id !== input.shiftId) throw new Error('Cannot record activity on a closed shift')
        if ((input.type === 'CASH_IN' || input.type === 'CASH_OUT') && (!input.amount || input.amount <= 0)) {
          throw new Error('Cash in/out requires a positive amount')
        }
        const lastBreakEvent = [...shiftActivities]
          .reverse()
          .find((a) => a.shiftId === input.shiftId && (a.type === 'BREAK_START' || a.type === 'BREAK_END'))
        const onBreak = lastBreakEvent?.type === 'BREAK_START'
        if (input.type === 'BREAK_START' && onBreak) throw new Error('Already on break')
        if (input.type === 'BREAK_END' && !onBreak) throw new Error('Not currently on break')

        shiftActivities.push({
          id: mockId(),
          shiftId: input.shiftId,
          type: input.type,
          amount: input.amount ?? null,
          note: input.note ?? null,
          createdAt: new Date().toISOString()
        })
        return delay(undefined)
      },
      listActivities: (input) => delay(shiftActivities.filter((a) => a.shiftId === input.shiftId)),
      report: (input) => {
        if (!openShift || openShift.id !== input.shiftId) throw new Error('Shift not found')
        const shiftOrders = orders.filter((o) => o.shiftId === input.shiftId)
        const completed = shiftOrders.filter((o) => o.status === 'COMPLETED')
        const cancelled = shiftOrders.filter((o) => o.status === 'CANCELLED')
        const cashSales = completed.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.total, 0)
        const activities = shiftActivities.filter((a) => a.shiftId === input.shiftId)
        const cashIn = activities.filter((a) => a.type === 'CASH_IN').reduce((sum, a) => sum + (a.amount ?? 0), 0)
        const cashOut = activities.filter((a) => a.type === 'CASH_OUT').reduce((sum, a) => sum + (a.amount ?? 0), 0)
        const paymentBreakdown = (['CASH', 'CARD', 'JAZZCASH', 'EASYPAISA'] as const)
          .map((method) => ({
            method,
            count: completed.filter((o) => o.paymentMethod === method).length,
            total: completed.filter((o) => o.paymentMethod === method).reduce((sum, o) => sum + o.total, 0)
          }))
          .filter((b) => b.count > 0)

        return delay({
          shiftId: input.shiftId,
          cashierName: openShift.cashierName,
          openingFloat: openShift.openingFloat,
          closingFloat: null,
          expectedCash: null,
          variance: null,
          openedAt: openShift.openedAt,
          closedAt: null,
          completedOrderCount: completed.length,
          voidedOrderCount: cancelled.length,
          subtotal: completed.reduce((sum, o) => sum + o.subtotal, 0),
          discountAmount: completed.reduce((sum, o) => sum + o.discountAmount, 0),
          taxAmount: completed.reduce((sum, o) => sum + o.taxAmount, 0),
          total: completed.reduce((sum, o) => sum + o.total, 0),
          paymentBreakdown,
          cashSales,
          cashIn,
          cashOut,
          activities
        })
      },
      close: (input) => {
        if (!openShift || openShift.id !== input.shiftId) throw new Error('Shift is already closed')
        const shiftOrders = orders.filter((o) => o.shiftId === input.shiftId && o.status === 'COMPLETED')
        const cashSales = shiftOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.total, 0)
        const activities = shiftActivities.filter((a) => a.shiftId === input.shiftId)
        const cashIn = activities.filter((a) => a.type === 'CASH_IN').reduce((sum, a) => sum + (a.amount ?? 0), 0)
        const cashOut = activities.filter((a) => a.type === 'CASH_OUT').reduce((sum, a) => sum + (a.amount ?? 0), 0)
        const expectedCash = openShift.openingFloat + cashSales + cashIn - cashOut
        const countedCash = Math.round(input.countedCash)
        const variance = countedCash - expectedCash
        openShift = null
        return delay({ shiftId: input.shiftId, expectedCash, countedCash, variance })
      }
    },
    orders: {
      create: (input) => {
        const resolvedItems: MockOrderItem[] = input.lines.map((line) => {
          const item = items.find((i) => i.id === line.itemId)
          if (!item) throw new Error('Item not found')
          const variation = line.variationId ? item.variations.find((v) => v.id === line.variationId) ?? null : null
          const addons = (line.addOnIds ?? [])
            .map((id) => item.addons.find((a) => a.id === id))
            .filter((a): a is MockAddon => Boolean(a))
          const unitPrice = PosLogic.computeUnitPrice({ basePrice: item.price, variation, addOns: addons })
          return {
            id: mockId(),
            itemId: item.id,
            variationId: variation?.id ?? null,
            name: variation ? `${item.name} (${variation.name})` : item.name,
            unitPrice,
            quantity: line.quantity,
            addons,
            notes: line.notes ?? null
          }
        })
        const subtotal = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
        const discountAmount = PosLogic.computeDiscountAmount(subtotal, input.discount ?? null, taxConfig().roundingMethod)
        const totals = PosLogic.computeOrderTotals(subtotal, discountAmount, 'CASH', taxConfig())
        orderCounter += 1
        const table = input.tableId ? mockTables.find((t) => t.id === input.tableId) : undefined
        const order: MockOrder = {
          id: mockId(),
          orderNumber: `ORD-MOCK-${String(orderCounter).padStart(3, '0')}`,
          type: input.type,
          status: 'PENDING',
          tableId: table?.id ?? null,
          tableLabel: table?.label ?? null,
          cashierId: input.cashierId,
          shiftId: input.shiftId,
          paymentMethod: null,
          subtotal: totals.subtotal,
          taxRatePercent: totals.taxRatePercent,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          total: totals.total,
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          items: resolvedItems
        }
        orders.push(order)
        if (table && order.type === 'DINE_IN') table.status = 'OCCUPIED'
        return delay({ id: order.id, orderNumber: order.orderNumber })
      },
      sendToKitchen: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (order) {
          order.status = 'IN_KITCHEN'
          enqueueKotJob(order.id)
        }
        return delay(undefined)
      },
      markReady: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (order) order.status = 'READY'
        return delay(undefined)
      },
      void: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (order) {
          order.status = 'CANCELLED'
          maybeFreeMockTable(order.tableId)
        }
        return delay(undefined)
      },
      voidItem: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (order) order.items = order.items.filter((i) => i.id !== input.orderItemId)
        return delay(undefined)
      },
      listActive: () => delay(orders.filter((o) => ['PENDING', 'IN_KITCHEN', 'READY'].includes(o.status))),
      get: (input) => delay(orders.find((o) => o.id === input.id) ?? null)
    },
    payments: {
      collect: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (!order) throw new Error('Order not found')
        const totals = PosLogic.computeOrderTotals(order.subtotal, order.discountAmount, input.paymentMethod, taxConfig())
        order.status = 'COMPLETED'
        order.taxRatePercent = totals.taxRatePercent
        order.taxAmount = totals.taxAmount
        order.total = totals.total
        order.paymentMethod = input.paymentMethod
        const changeGiven =
          input.paymentMethod === 'CASH' ? Math.round((input.tenderedAmount ?? 0) - totals.total) : 0
        enqueueReceiptJob(order.id, true)
        maybeFreeMockTable(order.tableId)
        return delay({ paymentId: mockId(), order, changeGiven })
      }
    },
    printers: {
      list: () => delay(printers.slice()),
      create: (input) => {
        const id = mockId()
        if (input.isDefault) {
          for (const p of printers) if (p.purpose === input.purpose) p.is_default = 0
        }
        printers.push({
          id,
          name: input.name,
          purpose: input.purpose,
          connection_type: input.connectionType,
          os_printer_name: input.osPrinterName ?? null,
          network_host: input.networkHost ?? null,
          network_port: input.networkPort ?? 9100,
          paper_width_mm: input.paperWidthMm ?? 80,
          is_default: input.isDefault ? 1 : 0,
          created_at: new Date().toISOString()
        })
        return delay({ id })
      },
      update: (input) => {
        const printer = printers.find((p) => p.id === input.id)
        if (!printer) throw new Error('Printer not found')
        if (input.isDefault) {
          for (const p of printers) if (p.purpose === input.purpose) p.is_default = 0
        }
        Object.assign(printer, {
          name: input.name,
          purpose: input.purpose,
          connection_type: input.connectionType,
          os_printer_name: input.osPrinterName ?? null,
          network_host: input.networkHost ?? null,
          network_port: input.networkPort ?? 9100,
          paper_width_mm: input.paperWidthMm ?? 80,
          is_default: input.isDefault ? 1 : 0
        })
        return delay(undefined)
      },
      delete: (input) => {
        if (printJobs.some((j) => j.printer_id === input.id)) {
          throw new Error('Cannot delete a printer that has print jobs in its history')
        }
        const index = printers.findIndex((p) => p.id === input.id)
        if (index >= 0) printers.splice(index, 1)
        return delay(undefined)
      },
      listOsPrinters: () => delay(['Microsoft Print to PDF', 'EPSON TM-T82 Receipt', 'XP-80C Thermal'])
    },
    printJobs: {
      list: (input) => {
        const filtered = input?.status ? printJobs.filter((j) => j.status === input.status) : printJobs
        return delay(filtered.slice().reverse())
      },
      retry: (input) => {
        const job = printJobs.find((j) => j.id === input.jobId)
        if (job && job.status === 'DEAD_LETTER') {
          job.status = 'PENDING'
          job.attempts = 0
        }
        return delay(undefined)
      },
      processNow: () => {
        let succeeded = 0
        let failed = 0
        let deadLettered = 0
        for (const job of printJobs) {
          if (job.status !== 'PENDING' && job.status !== 'FAILED') continue
          const printer = printers.find((p) => p.id === job.printer_id)
          // Simulated hardware reality for click-through testing: no real network printer is reachable from a browser tab, so NETWORK jobs always fail here (exercising the retry/dead-letter UI); WINDOWS/PDF_ONLY "succeed" since they just render a PDF.
          const wouldSucceed = !printer || printer.connection_type !== 'NETWORK'
          if (wouldSucceed) {
            job.status = 'SUCCEEDED'
            succeeded += 1
          } else {
            job.attempts += 1
            if (job.attempts >= job.max_attempts) {
              job.status = 'DEAD_LETTER'
              job.last_error = 'Timed out connecting to printer (simulated)'
              deadLettered += 1
            } else {
              job.status = 'FAILED'
              job.last_error = 'Timed out connecting to printer (simulated)'
              failed += 1
            }
          }
        }
        return delay({ succeeded, failed, deadLettered })
      },
      reprintReceipt: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (!order) throw new Error('Order not found')
        enqueueReceiptJob(order.id, input.isPaid, input.printerId)
        return delay(mockId())
      },
      reprintKot: (input) => {
        const order = orders.find((o) => o.id === input.orderId)
        if (!order) throw new Error('Order not found')
        enqueueKotJob(order.id, input.printerId)
        return delay(mockId())
      }
    },
    reports: {
      generate: (input) => delay(generateMockReport(input)),
      export: (input) => delay({ filePath: `(dev mock) ${input.request.kind.toLowerCase()}.${input.format}` }),
      openFile: () => delay(undefined)
    },
    backups: {
      list: () => delay(backups.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1))),
      create: () => {
        const row: MockBackup = {
          id: mockId(),
          file_path: `(dev mock) backup-${Date.now()}.db`,
          trigger_type: 'MANUAL',
          size_bytes: 40_000 + Math.round(Math.random() * 20_000),
          created_at: new Date().toISOString()
        }
        backups.push(row)
        return delay(row)
      },
      delete: (input) => {
        const index = backups.findIndex((b) => b.id === input.id)
        if (index >= 0) backups.splice(index, 1)
        return delay(undefined)
      },
      restore: () => delay(undefined)
    },
    licensing: {
      getStatus: () =>
        delay(
          mockActivated
            ? {
                activated: true,
                license: {
                  licenseId: 'mock-license',
                  restaurantName: restaurant?.name ?? 'Dev Restaurant',
                  machineFingerprint: MOCK_FINGERPRINT,
                  issuedAt: new Date().toISOString(),
                  expiresAt: null
                },
                reason: null,
                machineFingerprint: MOCK_FINGERPRINT
              }
            : { activated: false, license: null, reason: 'NOT_ACTIVATED' as const, machineFingerprint: MOCK_FINGERPRINT }
        ),
      importAndActivate: () => {
        mockActivated = true
        return delay({
          activated: true,
          license: {
            licenseId: 'mock-license',
            restaurantName: restaurant?.name ?? 'Dev Restaurant',
            machineFingerprint: MOCK_FINGERPRINT,
            issuedAt: new Date().toISOString(),
            expiresAt: null
          },
          reason: null,
          machineFingerprint: MOCK_FINGERPRINT
        })
      }
    }
  }
}

function inRange(isoDate: string, startDate: string, endDate: string): boolean {
  const day = isoDate.slice(0, 10)
  return day >= startDate && day <= endDate
}

function generateMockReport(request: {
  kind: 'DAILY_SALES' | 'SHIFT' | 'TAX' | 'MENU_PERFORMANCE' | 'STAFF' | 'VOID_DISCOUNT'
  startDate?: string
  endDate?: string
  shiftId?: string
}) {
  const generatedAt = new Date().toISOString()

  if (request.kind === 'SHIFT') {
    if (!openShift) throw new Error('Shift not found')
    const shiftOrders = orders.filter((o) => o.shiftId === request.shiftId && o.status === 'COMPLETED')
    const cashSales = shiftOrders.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + o.total, 0)
    return {
      title: 'Shift Report',
      subtitle: openShift.cashierName,
      generatedAt,
      sections: [
        {
          title: 'Summary',
          columns: [
            { key: 'label', label: 'Item' },
            { key: 'value', label: 'Amount', format: 'currency' as const }
          ],
          rows: [
            { label: 'Opening float', value: openShift.openingFloat },
            { label: 'Cash sales', value: cashSales },
            { label: 'Completed orders', value: shiftOrders.length }
          ]
        }
      ]
    }
  }

  const { startDate = '', endDate = '' } = request
  const inWindow = orders.filter((o) => o.status === 'COMPLETED' && inRange(o.createdAt, startDate, endDate))

  if (request.kind === 'DAILY_SALES') {
    const byDay = new Map<string, { order_count: number; subtotal: number; discount_amount: number; tax_amount: number; total: number }>()
    for (const o of inWindow) {
      const day = o.createdAt.slice(0, 10)
      const acc = byDay.get(day) ?? { order_count: 0, subtotal: 0, discount_amount: 0, tax_amount: 0, total: 0 }
      acc.order_count += 1
      acc.subtotal += o.subtotal
      acc.discount_amount += o.discountAmount
      acc.tax_amount += o.taxAmount
      acc.total += o.total
      byDay.set(day, acc)
    }
    const rows = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, acc]) => ({ day, ...acc }))
    const totals = rows.reduce(
      (acc, r) => ({
        order_count: acc.order_count + r.order_count,
        subtotal: acc.subtotal + r.subtotal,
        discount_amount: acc.discount_amount + r.discount_amount,
        tax_amount: acc.tax_amount + r.tax_amount,
        total: acc.total + r.total
      }),
      { order_count: 0, subtotal: 0, discount_amount: 0, tax_amount: 0, total: 0 }
    )
    return {
      title: 'Daily Sales Report',
      subtitle: `${startDate} to ${endDate}`,
      generatedAt,
      sections: [
        {
          columns: [
            { key: 'day', label: 'Date' },
            { key: 'order_count', label: 'Orders', format: 'number' as const },
            { key: 'subtotal', label: 'Subtotal', format: 'currency' as const },
            { key: 'discount_amount', label: 'Discount', format: 'currency' as const },
            { key: 'tax_amount', label: 'Tax', format: 'currency' as const },
            { key: 'total', label: 'Total', format: 'currency' as const }
          ],
          rows,
          summaryRow: { day: 'TOTAL', ...totals }
        }
      ]
    }
  }

  if (request.kind === 'TAX') {
    const byRate = new Map<number, { order_count: number; taxable_amount: number; tax_collected: number }>()
    for (const o of inWindow) {
      const acc = byRate.get(o.taxRatePercent) ?? { order_count: 0, taxable_amount: 0, tax_collected: 0 }
      acc.order_count += 1
      acc.taxable_amount += o.subtotal - o.discountAmount
      acc.tax_collected += o.taxAmount
      byRate.set(o.taxRatePercent, acc)
    }
    const rows = [...byRate.entries()].sort(([a], [b]) => a - b).map(([rate_percent, acc]) => ({ rate_percent, ...acc }))
    return {
      title: 'Tax Report',
      subtitle: `${startDate} to ${endDate}`,
      generatedAt,
      sections: [
        {
          columns: [
            { key: 'rate_percent', label: 'Tax rate', format: 'percent' as const },
            { key: 'order_count', label: 'Orders', format: 'number' as const },
            { key: 'taxable_amount', label: 'Taxable amount', format: 'currency' as const },
            { key: 'tax_collected', label: 'Tax collected', format: 'currency' as const }
          ],
          rows
        }
      ]
    }
  }

  if (request.kind === 'MENU_PERFORMANCE') {
    const byItem = new Map<string, { item_name: string; category_name: string; quantity_sold: number; revenue: number }>()
    for (const o of inWindow) {
      for (const line of o.items) {
        const item = items.find((i) => i.id === line.itemId)
        const category = categories.find((c) => c.id === item?.categoryId)
        const acc = byItem.get(line.itemId) ?? {
          item_name: item?.name ?? line.name,
          category_name: category?.name ?? '',
          quantity_sold: 0,
          revenue: 0
        }
        acc.quantity_sold += line.quantity
        acc.revenue += line.unitPrice * line.quantity
        byItem.set(line.itemId, acc)
      }
    }
    const rows = [...byItem.values()].sort((a, b) => b.revenue - a.revenue)
    return {
      title: 'Menu Performance Report',
      subtitle: `${startDate} to ${endDate}`,
      generatedAt,
      sections: [
        {
          columns: [
            { key: 'item_name', label: 'Item' },
            { key: 'category_name', label: 'Category' },
            { key: 'quantity_sold', label: 'Qty sold', format: 'number' as const },
            { key: 'revenue', label: 'Revenue', format: 'currency' as const }
          ],
          rows
        }
      ]
    }
  }

  if (request.kind === 'STAFF') {
    const byStaff = new Map<string, { staff_name: string; order_count: number; total_sales: number }>()
    for (const o of inWindow) {
      const user = users.find((u) => u.id === o.cashierId)
      const acc = byStaff.get(o.cashierId) ?? { staff_name: user?.name ?? 'Unknown', order_count: 0, total_sales: 0 }
      acc.order_count += 1
      acc.total_sales += o.total
      byStaff.set(o.cashierId, acc)
    }
    const rows = [...byStaff.values()]
      .map((r) => ({ ...r, average_order: r.order_count > 0 ? Math.round(r.total_sales / r.order_count) : 0 }))
      .sort((a, b) => b.total_sales - a.total_sales)
    return {
      title: 'Staff Report',
      subtitle: `${startDate} to ${endDate}`,
      generatedAt,
      sections: [
        {
          columns: [
            { key: 'staff_name', label: 'Staff' },
            { key: 'order_count', label: 'Orders', format: 'number' as const },
            { key: 'total_sales', label: 'Total sales', format: 'currency' as const },
            { key: 'average_order', label: 'Avg order', format: 'currency' as const }
          ],
          rows
        }
      ]
    }
  }

  // VOID_DISCOUNT
  const voided = orders.filter((o) => o.status === 'CANCELLED' && inRange(o.createdAt, startDate, endDate))
  const discounted = inWindow.filter((o) => o.discountAmount > 0)
  return {
    title: 'Void & Discount Report',
    subtitle: `${startDate} to ${endDate}`,
    generatedAt,
    sections: [
      {
        title: 'Voided orders',
        columns: [
          { key: 'order_number', label: 'Order' },
          { key: 'total', label: 'Amount', format: 'currency' as const }
        ],
        rows: voided.map((o) => ({ order_number: o.orderNumber, total: o.total }))
      },
      {
        title: 'Discounts applied',
        columns: [
          { key: 'order_number', label: 'Order' },
          { key: 'subtotal', label: 'Subtotal', format: 'currency' as const },
          { key: 'discount_amount', label: 'Discount', format: 'currency' as const }
        ],
        rows: discounted.map((o) => ({ order_number: o.orderNumber, subtotal: o.subtotal, discount_amount: o.discountAmount }))
      }
    ]
  }
}

/** Mirrors the real backend's maybeFreeTable (orders.service.ts): only frees a table once no other still-active order references it — a held/kitchen order on the same table must keep it occupied. */
function maybeFreeMockTable(tableId: string | null): void {
  if (!tableId) return
  const stillActive = orders.some(
    (o) => o.tableId === tableId && ['PENDING', 'IN_KITCHEN', 'READY'].includes(o.status)
  )
  if (!stillActive) {
    const table = mockTables.find((t) => t.id === tableId)
    if (table) table.status = 'FREE'
  }
}

function toPrintOrder(order: MockOrder): PosLogic.PrintOrder {
  return {
    orderNumber: order.orderNumber,
    type: order.type,
    restaurantName: restaurant?.name ?? 'Dineiz',
    restaurantAddress: restaurant?.address ?? undefined,
    restaurantNtn: restaurant?.ntn ?? undefined,
    receiptHeader: restaurant?.receipt_header ?? undefined,
    receiptFooter: restaurant?.receipt_footer ?? undefined,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.unitPrice * i.quantity,
      notes: i.notes ?? undefined,
      addOnNames: i.addons.map((a) => a.name)
    })),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    taxAmount: order.taxAmount,
    taxRatePercent: order.taxRatePercent,
    total: order.total,
    createdAt: order.createdAt,
    tableLabel: order.tableLabel ?? undefined
  }
}

function enqueueReceiptJob(orderId: string, isPaid: boolean, explicitPrinterId?: string): void {
  const printer = explicitPrinterId
    ? printers.find((p) => p.id === explicitPrinterId)
    : printers.find((p) => p.purpose === 'RECEIPT' && p.is_default === 1)
  if (!printer) return
  const order = orders.find((o) => o.id === orderId)
  if (!order) return
  const doc = PosLogic.buildBillDocument(toPrintOrder(order), { isPaid })
  pushPrintJob(printer.id, 'RECEIPT', orderId, doc)
}

function enqueueKotJob(orderId: string, explicitPrinterId?: string): void {
  const printer = explicitPrinterId
    ? printers.find((p) => p.id === explicitPrinterId)
    : printers.find((p) => p.purpose === 'KITCHEN' && p.is_default === 1)
  if (!printer) return
  const order = orders.find((o) => o.id === orderId)
  if (!order) return
  const doc = PosLogic.buildKotDocument(toPrintOrder(order))
  pushPrintJob(printer.id, 'KOT', orderId, doc)

  // Rush Hour Mode: also print an itemized (priced) order ticket alongside the KOT.
  if (restaurant?.rush_hour_mode) {
    enqueueReceiptJob(orderId, false)
  }
}

function pushPrintJob(printerId: string, documentType: MockPrintJob['document_type'], orderId: string, doc: PosLogic.ReceiptDocument): void {
  const now = new Date().toISOString()
  printJobs.push({
    id: mockId(),
    printer_id: printerId,
    document_type: documentType,
    order_id: orderId,
    payload_json: JSON.stringify(doc),
    status: 'PENDING',
    attempts: 0,
    max_attempts: 5,
    next_attempt_at: now,
    last_error: null,
    created_at: now,
    updated_at: now
  })
}
