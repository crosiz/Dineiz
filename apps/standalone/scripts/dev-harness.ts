/**
 * Exercises real src/main/services/*.ts functions against a throwaway SQLite
 * file (never %APPDATA%\Dineiz\dineiz.db). Grown incrementally, one section
 * per phase, rather than one script per phase.
 *
 * Must run under Electron-as-Node, not plain node — better-sqlite3's native
 * binary in this repo is rebuilt against Electron's ABI:
 *   pnpm --filter @dineiz/standalone harness:build
 *   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron.exe .harness-build/scripts/dev-harness.js
 */
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/main/db/migrate'
import { completeSetup, isSetupComplete } from '../src/main/services/setup.service'
import {
  createUser,
  listActiveStaff,
  listAllStaff,
  login,
  resetOwnerPasswordWithRecoveryCode,
  setUserActive
} from '../src/main/services/auth.service'
import {
  createAddon,
  createCategory,
  createItem,
  createVariation,
  deleteCategory,
  deleteItem,
  deleteVariation,
  getFullMenu,
  setItemAvailability,
  updateItem
} from '../src/main/services/menu.service'
import { buildShiftReportData, closeShift, listActivities, openShift, recordActivity } from '../src/main/services/shifts.service'
import {
  createFloor,
  createTable,
  deleteFloor,
  deleteTable,
  getFullFloorPlan,
  renameFloor,
  setTableStatus,
  updateTable
} from '../src/main/services/tables.service'
import { createOrder, getOrder, listActive, markReady, sendToKitchen, voidOrder, voidOrderItem } from '../src/main/services/orders.service'
import { collectPayment } from '../src/main/services/payments.service'
import { createPrinter, deletePrinter, listPrinters } from '../src/main/services/printers.service'
import { enqueuePrintJob, listPrintJobs, processQueueOnce, retryDeadLetter } from '../src/main/printing/printQueue'
import { renderReceiptToPdf } from '../src/main/printing/pdfRenderer'
import { buildPrintOrder } from '../src/main/printing/receiptData'
import type { PrinterConfig } from '../src/main/printing/printerTransport'
import { buildBillDocument, buildKotDocument } from '@dineiz/pos-logic'
import type { ReceiptDocument } from '@dineiz/pos-logic'
import {
  buildDailySalesReport,
  buildMenuPerformanceReport,
  buildStaffReport,
  buildTaxReport,
  buildVoidDiscountReport
} from '../src/main/reports/reports.service'
import { renderReportToPdf } from '../src/main/reports/reportPdfRenderer'
import { renderReportToExcel } from '../src/main/reports/reportExcelRenderer'
import { createBackup, listBackups } from '../src/main/services/backup.service'
import { performRestore } from '../src/main/db/restore'
import { generateKeyPairSync } from 'node:crypto'
import { signLicensePayload } from '../src/main/licensing/sign'
import { verifyLicense } from '../src/main/licensing/verify'
import { activateLicense, getLicenseStatus } from '../src/main/licensing/license.service'
import { getMachineFingerprint } from '../src/main/licensing/fingerprint'
import type { LicensePayload } from '@dineiz/pos-logic'
import { updateRestaurantSettings } from '../src/main/services/settings.service'
import { checkForUpdates } from '../src/main/updater/autoUpdate'

let failures = 0

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failures += 1
    console.error(`FAIL: ${message}`)
  } else {
    console.log(`ok:   ${message}`)
  }
}

function phase3SetupAndAuth(db: Database.Database): { cashierId: string; ownerId: string } {
  console.log('\n--- Phase 3: setup + auth ---')

  assert(isSetupComplete(db) === false, 'setup starts incomplete on a fresh db')

  const setupResult = completeSetup(db, {
    restaurantName: 'Test Cafe',
    address: '123 Test St',
    cashTaxRatePercent: 5,
    cardTaxRatePercent: 17,
    ownerName: 'Alice Owner',
    ownerEmail: 'alice@example.com',
    ownerPassword: 'secret123'
  })
  assert(
    typeof setupResult.restaurantId === 'string' && setupResult.restaurantId.length > 0,
    'completeSetup returns a restaurantId'
  )
  assert(isSetupComplete(db) === true, 'setup is complete after completeSetup')

  let threwOnSecondSetup = false
  try {
    completeSetup(db, {
      restaurantName: 'Second Cafe',
      cashTaxRatePercent: 5,
      cardTaxRatePercent: 17,
      ownerName: 'Bob',
      ownerPassword: 'secret123'
    })
  } catch {
    threwOnSecondSetup = true
  }
  assert(threwOnSecondSetup, 'completeSetup throws if setup is already complete')

  const ownerLoginOk = login(db, { userId: setupResult.ownerId, password: 'secret123' })
  assert(ownerLoginOk.ok === true, 'owner logs in with correct password')

  const ownerLoginBad = login(db, { userId: setupResult.ownerId, password: 'wrong' })
  assert(
    ownerLoginBad.ok === false && ownerLoginBad.reason === 'INVALID_CREDENTIALS',
    'owner login rejects wrong password'
  )

  // The recovery code is the only way back in if an owner forgets their
  // password (this app is offline — no email reset exists). Verify the
  // whole loop: a wrong code is rejected without touching the password,
  // the real code resets it, and the old password stops working while the
  // new one starts.
  assert(
    /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(setupResult.ownerRecoveryCode),
    `completeSetup returns a recovery code in the expected XXXXX-XXXXX-XXXXX-XXXXX format (got "${setupResult.ownerRecoveryCode}")`
  )

  let threwOnWrongRecoveryCode = false
  try {
    resetOwnerPasswordWithRecoveryCode(db, {
      userId: setupResult.ownerId,
      recoveryCode: 'WRONG-WRONG-WRONG-WRONG',
      newPassword: 'shouldnotapply'
    })
  } catch {
    threwOnWrongRecoveryCode = true
  }
  assert(threwOnWrongRecoveryCode, 'resetOwnerPasswordWithRecoveryCode rejects an incorrect recovery code')
  assert(
    login(db, { userId: setupResult.ownerId, password: 'secret123' }).ok === true,
    'a rejected recovery attempt leaves the original password untouched'
  )

  let threwOnRecoveryForNonOwner = false
  try {
    resetOwnerPasswordWithRecoveryCode(db, {
      userId: 'does-not-exist',
      recoveryCode: setupResult.ownerRecoveryCode,
      newPassword: 'whatever123'
    })
  } catch {
    threwOnRecoveryForNonOwner = true
  }
  assert(threwOnRecoveryForNonOwner, 'resetOwnerPasswordWithRecoveryCode rejects a userId that is not a real owner')

  resetOwnerPasswordWithRecoveryCode(db, {
    userId: setupResult.ownerId,
    recoveryCode: setupResult.ownerRecoveryCode.toLowerCase(), // typed lowercase — must still match
    newPassword: 'newsecret456'
  })
  assert(
    login(db, { userId: setupResult.ownerId, password: 'secret123' }).ok === false,
    'the old password no longer works after a recovery reset'
  )
  assert(
    login(db, { userId: setupResult.ownerId, password: 'newsecret456' }).ok === true,
    'the new password set via a lowercase-typed recovery code works'
  )

  const cashier = createUser(db, { name: 'Charlie Cashier', role: 'CASHIER', pin: '1234' })
  const staffList = listActiveStaff(db)
  assert(
    staffList.some((s) => s.id === cashier.id),
    'new cashier appears in listActiveStaff'
  )
  assert(
    staffList.every((s) => !('pin_hash' in s) && !('password_hash' in s)),
    'listActiveStaff never exposes pin_hash/password_hash'
  )

  const cashierLoginOk = login(db, { userId: cashier.id, pin: '1234' })
  assert(cashierLoginOk.ok === true, 'cashier logs in with correct PIN')

  const cashierLoginBadPin = login(db, { userId: cashier.id, pin: '9999' })
  assert(cashierLoginBadPin.ok === false, 'cashier login rejects wrong PIN')

  const cashierLoginWithPassword = login(db, { userId: cashier.id, password: 'anything' })
  assert(cashierLoginWithPassword.ok === false, 'cashier has no password hash, so password login fails')

  const unknownUserLogin = login(db, { userId: 'does-not-exist', pin: '1234' })
  assert(
    unknownUserLogin.ok === false && unknownUserLogin.reason === 'NOT_FOUND',
    'login on an unknown user id reports NOT_FOUND'
  )

  setUserActive(db, cashier.id, false)
  assert(
    !listActiveStaff(db).some((s) => s.id === cashier.id),
    'a deactivated staff member disappears from listActiveStaff'
  )
  assert(
    listAllStaff(db).some((s) => s.id === cashier.id && s.isActive === false),
    'listAllStaff still shows the deactivated staff member, correctly flagged inactive'
  )
  const deactivatedLogin = login(db, { userId: cashier.id, pin: '1234' })
  assert(deactivatedLogin.ok === false && deactivatedLogin.reason === 'INACTIVE', 'a deactivated staff member cannot log in')
  setUserActive(db, cashier.id, true)
  assert(login(db, { userId: cashier.id, pin: '1234' }).ok === true, 'reactivating restores login access')

  return { cashierId: cashier.id, ownerId: setupResult.ownerId }
}

function seedHistoricalOrder(
  db: Database.Database,
  shiftId: string,
  cashierId: string,
  itemId: string,
  variationId: string | null
): void {
  db.prepare(
    `INSERT INTO orders (id, order_number, type, status, shift_id, cashier_id, subtotal, tax_amount, discount_amount, total)
     VALUES ('test-order-1', 'ORD-TEST-1', 'DINE_IN', 'COMPLETED', ?, ?, 100, 0, 0, 100)`
  ).run(shiftId, cashierId)
  db.prepare(
    `INSERT INTO order_items (id, order_id, item_id, variation_id, name, unit_price, quantity)
     VALUES ('test-order-item-1', 'test-order-1', ?, ?, 'Test Item', 100, 1)`
  ).run(itemId, variationId)
}

function phase4Menu(db: Database.Database, shiftId: string, cashierId: string): { categoryId: string; itemId: string; variationId: string; addonId: string } {
  console.log('\n--- Phase 4: menu ---')

  assert(getFullMenu(db).categories.length === 0, 'menu starts empty on a fresh db')

  const category = createCategory(db, { name: 'Karahi' })
  const menuAfterCategory = getFullMenu(db)
  assert(menuAfterCategory.categories.length === 1, 'created category appears in getFullMenu')
  assert(menuAfterCategory.categories[0].items.length === 0, 'new category starts with no items')

  const item = createItem(db, { categoryId: category.id, name: 'Chicken Karahi', price: 1200.6 })
  const menuAfterItem = getFullMenu(db)
  const nestedItem = menuAfterItem.categories[0].items[0]
  assert(nestedItem?.id === item.id, 'created item is nested under its category')
  assert(nestedItem?.price === 1201, 'item price is rounded to a whole rupee (1200.6 -> 1201)')
  assert(nestedItem?.isAvailable === true, 'new item defaults to available')

  let threwOnNegativePrice = false
  try {
    createItem(db, { categoryId: category.id, name: 'Bad Item', price: -5 })
  } catch {
    threwOnNegativePrice = true
  }
  assert(threwOnNegativePrice, 'createItem rejects a negative price')

  const variation = createVariation(db, { itemId: item.id, name: 'Full', price: 1200 })
  const addon = createAddon(db, { itemId: item.id, name: 'Extra Spicy', price: 0 })
  const menuWithVariationsAndAddons = getFullMenu(db)
  const itemWithChildren = menuWithVariationsAndAddons.categories[0].items[0]
  assert(
    itemWithChildren.variations.length === 1 && itemWithChildren.variations[0].name === 'Full',
    'variation nests under its item'
  )
  assert(
    itemWithChildren.addons.length === 1 && itemWithChildren.addons[0].name === 'Extra Spicy',
    'add-on nests under its item'
  )

  updateItem(db, item.id, { name: 'Chicken Karahi (Updated)', price: 1300 })
  const menuAfterUpdate = getFullMenu(db)
  assert(menuAfterUpdate.categories[0].items[0].name === 'Chicken Karahi (Updated)', 'updateItem changes the name')
  assert(menuAfterUpdate.categories[0].items[0].price === 1300, 'updateItem changes the price')

  setItemAvailability(db, item.id, false)
  assert(getFullMenu(db).categories[0].items[0].isAvailable === false, 'setItemAvailability toggles availability')
  setItemAvailability(db, item.id, true)

  let threwOnCategoryWithItems = false
  try {
    deleteCategory(db, category.id)
  } catch {
    threwOnCategoryWithItems = true
  }
  assert(threwOnCategoryWithItems, 'deleteCategory refuses to delete a category that still has items')

  seedHistoricalOrder(db, shiftId, cashierId, item.id, variation.id)

  let threwOnOrderedItemDelete = false
  try {
    deleteItem(db, item.id)
  } catch {
    threwOnOrderedItemDelete = true
  }
  assert(threwOnOrderedItemDelete, 'deleteItem refuses to delete an item that appears in a past order')

  let threwOnOrderedVariationDelete = false
  try {
    deleteVariation(db, variation.id)
  } catch {
    threwOnOrderedVariationDelete = true
  }
  assert(threwOnOrderedVariationDelete, 'deleteVariation refuses to delete a variation that appears in a past order')

  const neverOrderedItem = createItem(db, { categoryId: category.id, name: 'Never Ordered', price: 500 })
  deleteItem(db, neverOrderedItem.id)
  assert(
    !getFullMenu(db).categories[0].items.some((i) => i.id === neverOrderedItem.id),
    'deleteItem succeeds for an item with no order history'
  )

  return { categoryId: category.id, itemId: item.id, variationId: variation.id, addonId: addon.id }
}

function phase4bTables(db: Database.Database, shiftId: string, cashierId: string, menu: { itemId: string }): void {
  console.log('\n--- Phase 4b: floors + tables ---')

  const initialFloors = getFullFloorPlan(db).floors
  assert(
    initialFloors.length === 1 && initialFloors[0].name === 'Main Floor',
    `setup auto-creates one default floor (got ${initialFloors.map((f) => f.name).join(', ')})`
  )
  const mainFloor = initialFloors[0]

  const floor2 = createFloor(db, { name: 'Rooftop' })
  assert(getFullFloorPlan(db).floors.length === 2, 'createFloor adds a second floor')

  renameFloor(db, floor2.id, 'Rooftop Terrace')
  assert(
    getFullFloorPlan(db).floors.find((f) => f.id === floor2.id)?.name === 'Rooftop Terrace',
    'renameFloor changes the floor name'
  )

  const table1 = createTable(db, { floorId: mainFloor.id, label: 'T1', seats: 4 })
  const freshTable1 = getFullFloorPlan(db).floors.find((f) => f.id === mainFloor.id)!.tables[0]
  assert(freshTable1.status === 'FREE', 'a new table starts FREE')
  assert(freshTable1.seats === 4, 'a new table keeps the seats it was created with')

  let threwOnDuplicateLabel = false
  try {
    createTable(db, { floorId: mainFloor.id, label: 'T1' })
  } catch {
    threwOnDuplicateLabel = true
  }
  assert(threwOnDuplicateLabel, 'createTable refuses a duplicate label on the same floor')

  const otherFloorTable = createTable(db, { floorId: floor2.id, label: 'T1' })
  assert(Boolean(otherFloorTable.id), 'the same label is allowed again on a different floor')
  deleteTable(db, otherFloorTable.id)

  updateTable(db, table1.id, { seats: 6 })
  assert(
    getFullFloorPlan(db).floors.find((f) => f.id === mainFloor.id)!.tables[0].seats === 6,
    'updateTable changes seats'
  )

  setTableStatus(db, table1.id, 'DIRTY')
  assert(
    getFullFloorPlan(db).floors.find((f) => f.id === mainFloor.id)!.tables[0].status === 'DIRTY',
    'setTableStatus sets a manual status (e.g. bussed but not yet reset)'
  )
  setTableStatus(db, table1.id, 'FREE')

  let threwOnDeleteFloorWithTables = false
  try {
    deleteFloor(db, mainFloor.id)
  } catch {
    threwOnDeleteFloorWithTables = true
  }
  assert(threwOnDeleteFloorWithTables, 'deleteFloor refuses to delete a floor that still has tables')

  const dineInOrder = createOrder(db, {
    type: 'DINE_IN',
    tableId: table1.id,
    cashierId,
    shiftId,
    lines: [{ itemId: menu.itemId, quantity: 1 }]
  })
  assert(
    getFullFloorPlan(db).floors.find((f) => f.id === mainFloor.id)!.tables[0].status === 'OCCUPIED',
    'createOrder against a table occupies it (tables.service view of the same effect phase5 checks via orders.service)'
  )

  let threwOnDeleteOccupiedTable = false
  try {
    deleteTable(db, table1.id)
  } catch {
    threwOnDeleteOccupiedTable = true
  }
  assert(threwOnDeleteOccupiedTable, 'deleteTable refuses to delete a table that is currently occupied')

  voidOrder(db, dineInOrder.id, 'test cleanup', cashierId)

  let threwOnDeleteTableWithHistory = false
  try {
    deleteTable(db, table1.id)
  } catch {
    threwOnDeleteTableWithHistory = true
  }
  assert(threwOnDeleteTableWithHistory, 'deleteTable refuses a table with order history even after it frees up')

  const neverOrderedTable = createTable(db, { floorId: mainFloor.id, label: 'T-temp' })
  deleteTable(db, neverOrderedTable.id)
  assert(
    !getFullFloorPlan(db).floors.find((f) => f.id === mainFloor.id)!.tables.some((t) => t.id === neverOrderedTable.id),
    'deleteTable succeeds for a table with no order history'
  )
}

function phase5Orders(
  db: Database.Database,
  shiftId: string,
  cashierId: string,
  menu: { itemId: string; variationId: string; addonId: string }
): { orderId: string } {
  console.log('\n--- Phase 5: orders ---')

  db.prepare("INSERT INTO floors (id, name, sort_order) VALUES ('floor-1', 'Main Floor', 0)").run()
  db.prepare("INSERT INTO tables (id, floor_id, label, seats, status) VALUES ('table-1', 'floor-1', 'T1', 4, 'FREE')").run()

  // Item base price is 1300 (set by updateItem above); variation price is
  // additive on top of base (matches the real cloud POS's own formula:
  // unitPrice = basePrice + variation.price + addOns), not a replacement —
  // so unitPrice = 1300 + 1200 (Full) + 0 (addon) = 2500, x2 qty = 5000.
  const created = createOrder(db, {
    type: 'DINE_IN',
    tableId: 'table-1',
    cashierId,
    shiftId,
    lines: [{ itemId: menu.itemId, variationId: menu.variationId, addOnIds: [menu.addonId], quantity: 2 }]
  })
  assert(/^ORD-\d{8}-\d{3}$/.test(created.orderNumber), `order number matches ORD-YYYYMMDD-NNN (got ${created.orderNumber})`)

  const order = getOrder(db, created.id)
  assert(order?.status === 'PENDING', 'new order starts PENDING')
  assert(order?.subtotal === 5000, `subtotal is 2*(1300+1200)=5000 (got ${order?.subtotal})`)
  assert(order?.taxRatePercent === 5, 'provisional order prices at the CASH rate (5%)')
  assert(order?.taxAmount === 250, `tax is 5000*5%=250 (got ${order?.taxAmount})`)
  assert(order?.total === 5250, `total is 5000+250=5250 (got ${order?.total})`)

  const table = db.prepare('SELECT status FROM tables WHERE id = ?').get('table-1') as { status: string }
  assert(table.status === 'OCCUPIED', 'dine-in order with a table occupies that table')

  let threwOnDoubleCreate = false
  try {
    createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId, lines: [] })
  } catch {
    threwOnDoubleCreate = true
  }
  assert(threwOnDoubleCreate, 'createOrder rejects an order with zero lines')

  sendToKitchen(db, created.id)
  assert(getOrder(db, created.id)?.status === 'IN_KITCHEN', 'sendToKitchen moves PENDING -> IN_KITCHEN')

  let threwOnDoubleSend = false
  try {
    sendToKitchen(db, created.id)
  } catch {
    threwOnDoubleSend = true
  }
  assert(threwOnDoubleSend, 'sendToKitchen refuses a second time (already IN_KITCHEN)')

  markReady(db, created.id)
  assert(getOrder(db, created.id)?.status === 'READY', 'markReady moves IN_KITCHEN -> READY')

  // Void one order item and confirm totals recompute correctly (not just subtracted).
  const orderItemId = getOrder(db, created.id)!.items[0].id
  const secondOrder = createOrder(db, {
    type: 'TAKEAWAY',
    cashierId,
    shiftId,
    lines: [
      { itemId: menu.itemId, variationId: menu.variationId, quantity: 1 },
      { itemId: menu.itemId, variationId: null, quantity: 1 }
    ]
  })
  const secondOrderItemId = getOrder(db, secondOrder.id)!.items[0].id
  voidOrderItem(db, secondOrder.id, secondOrderItemId, 'test void', cashierId, true)
  const afterVoidItem = getOrder(db, secondOrder.id)
  assert(afterVoidItem?.items.length === 1, 'voidOrderItem removes exactly one line')
  assert(
    afterVoidItem?.subtotal === 1300,
    `remaining line (base item, no variation) recomputes subtotal to 1300 (got ${afterVoidItem?.subtotal})`
  )

  voidOrder(db, secondOrder.id, 'test void whole order', cashierId)
  assert(getOrder(db, secondOrder.id)?.status === 'CANCELLED', 'voidOrder cancels the order')

  let threwOnVoidCompleted = false
  try {
    voidOrder(db, secondOrder.id, 'again', cashierId)
  } catch {
    threwOnVoidCompleted = true
  }
  assert(threwOnVoidCompleted, 'voidOrder refuses an already-CANCELLED order')

  const active = listActive(db)
  assert(
    active.some((o) => o.id === created.id) && !active.some((o) => o.id === secondOrder.id),
    'listActive includes READY orders and excludes CANCELLED ones'
  )
  void orderItemId

  return { orderId: created.id }
}

function phase6Payments(
  db: Database.Database,
  orderId: string,
  shiftId: string,
  cashierId: string,
  menu: { itemId: string }
): void {
  console.log('\n--- Phase 6: payments ---')

  let threwOnShortPay = false
  try {
    collectPayment(db, { orderId, paymentMethod: 'CASH', tenderedAmount: 100 })
  } catch {
    threwOnShortPay = true
  }
  assert(threwOnShortPay, 'collectPayment rejects cash tendered less than the total due')

  const result = collectPayment(db, { orderId, paymentMethod: 'CASH', tenderedAmount: 6000 })
  assert(result.order.status === 'COMPLETED', 'collectPayment marks the order COMPLETED')
  assert(result.order.taxRatePercent === 5, 'CASH payment prices at the cash rate (5%)')
  assert(result.changeGiven === 6000 - 5250, `change is 6000-5250=750 (got ${result.changeGiven})`)

  const table = db.prepare('SELECT status FROM tables WHERE id = ?').get('table-1') as { status: string }
  assert(table.status === 'FREE', 'table frees again once its order is paid')

  let threwOnDoublePay = false
  try {
    collectPayment(db, { orderId, paymentMethod: 'CASH', tenderedAmount: 5000 })
  } catch {
    threwOnDoublePay = true
  }
  assert(threwOnDoublePay, 'collectPayment refuses an order that is already COMPLETED')

  // A CARD payment must price at the card rate (17%), not the cash rate (5%) and not a
  // decimal-misread of either — the exact bug class this whole build exists to avoid.
  const cardOrder = createOrder(db, {
    type: 'TAKEAWAY',
    cashierId,
    shiftId,
    lines: [{ itemId: menu.itemId, quantity: 1 }] // base item price 1300, no variation
  })
  const cardResult = collectPayment(db, { orderId: cardOrder.id, paymentMethod: 'CARD' })
  assert(cardResult.order.taxRatePercent === 17, `CARD payment prices at 17%, not 5% (got ${cardResult.order.taxRatePercent})`)
  assert(cardResult.order.taxAmount === 221, `1300*17%=221 (got ${cardResult.order.taxAmount})`)
  assert(cardResult.changeGiven === 0, 'non-cash payments report zero change')
}

function phase8Shifts(db: Database.Database, previousShiftId: string, cashierId: string, menu: { itemId: string }): void {
  console.log('\n--- Phase 8: shifts + cash reconciliation ---')

  // Close out the shift used by phases 5-7 (arbitrary counted cash — its accumulated
  // activity isn't hand-verified here) so a fresh, fully-controlled shift can be opened.
  closeShift(db, { shiftId: previousShiftId, countedCash: 0 })

  const shift = openShift(db, cashierId, 2000)

  let threwOnActivityAfterClose = false
  try {
    recordActivity(db, { shiftId: previousShiftId, type: 'CASH_IN', amount: 100 })
  } catch {
    threwOnActivityAfterClose = true
  }
  assert(threwOnActivityAfterClose, 'recordActivity refuses to record on a closed shift')

  let threwOnNonPositiveCashIn = false
  try {
    recordActivity(db, { shiftId: shift.id, type: 'CASH_IN', amount: 0 })
  } catch {
    threwOnNonPositiveCashIn = true
  }
  assert(threwOnNonPositiveCashIn, 'recordActivity rejects a non-positive cash-in amount')

  recordActivity(db, { shiftId: shift.id, type: 'BREAK_START' })
  let threwOnDoubleBreakStart = false
  try {
    recordActivity(db, { shiftId: shift.id, type: 'BREAK_START' })
  } catch {
    threwOnDoubleBreakStart = true
  }
  assert(threwOnDoubleBreakStart, 'recordActivity refuses to start a break that is already active')
  recordActivity(db, { shiftId: shift.id, type: 'BREAK_END' })
  let threwOnDoubleBreakEnd = false
  try {
    recordActivity(db, { shiftId: shift.id, type: 'BREAK_END' })
  } catch {
    threwOnDoubleBreakEnd = true
  }
  assert(threwOnDoubleBreakEnd, 'recordActivity refuses to end a break that is not active')

  recordActivity(db, { shiftId: shift.id, type: 'CASH_IN', amount: 500, note: 'Change top-up' })
  recordActivity(db, { shiftId: shift.id, type: 'CASH_OUT', amount: 200, note: 'Sent to safe' })
  const activities = listActivities(db, shift.id)
  assert(activities.length === 4, `listActivities returns all 4 recorded events (got ${activities.length})`)

  // Two CASH orders (1300 and 2*1300) and one CARD order, all base item, no variation.
  const orderA = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId: shift.id, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  collectPayment(db, { orderId: orderA.id, paymentMethod: 'CASH', tenderedAmount: 2000 })
  const orderB = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId: shift.id, lines: [{ itemId: menu.itemId, quantity: 2 }] })
  collectPayment(db, { orderId: orderB.id, paymentMethod: 'CASH', tenderedAmount: 3000 })
  const orderC = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId: shift.id, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  collectPayment(db, { orderId: orderC.id, paymentMethod: 'CARD' })

  // subtotal 1300+2600+1300=5200; tax 65+130+221=416 (CASH@5%, CASH@5%, CARD@17%); total 5616.
  const report = buildShiftReportData(db, shift.id)
  assert(report.completedOrderCount === 3, `report counts 3 completed orders (got ${report.completedOrderCount})`)
  assert(report.voidedOrderCount === 0, 'report counts 0 voided orders')
  assert(report.subtotal === 5200, `report subtotal is 1300+2600+1300=5200 (got ${report.subtotal})`)
  assert(report.taxAmount === 416, `report tax is 65+130+221=416 (got ${report.taxAmount})`)
  assert(report.total === 5616, `report total is 1365+2730+1521=5616 (got ${report.total})`)
  assert(report.cashSales === 4095, `report cashSales is 1365+2730=4095 (got ${report.cashSales})`)
  assert(report.cashIn === 500 && report.cashOut === 200, `report cashIn/cashOut match recorded activities (got ${report.cashIn}/${report.cashOut})`)
  const cashBreakdown = report.paymentBreakdown.find((b) => b.method === 'CASH')
  const cardBreakdown = report.paymentBreakdown.find((b) => b.method === 'CARD')
  assert(cashBreakdown?.count === 2 && cashBreakdown.total === 4095, `paymentBreakdown CASH is 2 orders totalling 4095 (got ${JSON.stringify(cashBreakdown)})`)
  assert(cardBreakdown?.count === 1 && cardBreakdown.total === 1521, `paymentBreakdown CARD is 1 order totalling 1521 (got ${JSON.stringify(cardBreakdown)})`)

  // expectedCash = 2000 (opening) + 4095 (cash sales) + 500 (cash in) - 200 (cash out) = 6395.
  const closeResult = closeShift(db, { shiftId: shift.id, countedCash: 6395 })
  assert(closeResult.expectedCash === 6395, `expectedCash is 2000+4095+500-200=6395 (got ${closeResult.expectedCash})`)
  assert(closeResult.variance === 0, `drawer matches exactly, variance is 0 (got ${closeResult.variance})`)

  const shortResult = (() => {
    const shift2 = openShift(db, cashierId, 1000)
    return closeShift(db, { shiftId: shift2.id, countedCash: 700 })
  })()
  assert(shortResult.variance === -300, `counting 300 short of a 1000 opening float with no sales reports variance -300 (got ${shortResult.variance})`)

  let threwOnDoubleClose = false
  try {
    closeShift(db, { shiftId: shift.id, countedCash: 6395 })
  } catch {
    threwOnDoubleClose = true
  }
  assert(threwOnDoubleClose, 'closeShift refuses a shift that is already closed')
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Report aggregates are verified as before/after deltas rather than exact
 * absolute totals — earlier phases (5-8) already completed real orders
 * today, so an absolute assertion would be fragile against that shared
 * history. A delta across precisely-known new orders still proves the SQL
 * aggregation itself is correct, which is the actual thing under test.
 */
async function phase9Reports(db: Database.Database, cashierId: string, menu: { itemId: string }): Promise<void> {
  console.log('\n--- Phase 9: reports ---')

  const today = { startDate: todayDateString(), endDate: todayDateString() }
  const shift = openShift(db, cashierId, 1000)

  const salesBefore = buildDailySalesReport(db, today)
  const taxBefore = buildTaxReport(db, today)
  const menuBefore = buildMenuPerformanceReport(db, today)
  const staffBefore = buildStaffReport(db, today)

  // One CASH order (1300, 5% tax = 65, total 1365) and one CARD order (1300, 17% tax = 221, total 1521).
  const cashOrder = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId: shift.id, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  collectPayment(db, { orderId: cashOrder.id, paymentMethod: 'CASH', tenderedAmount: 2000 })
  const cardOrder = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId: shift.id, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  collectPayment(db, { orderId: cardOrder.id, paymentMethod: 'CARD' })

  const salesAfter = buildDailySalesReport(db, today)
  const salesBeforeTotal = (salesBefore.sections[0].summaryRow?.total as number) ?? 0
  const salesAfterTotal = (salesAfter.sections[0].summaryRow?.total as number) ?? 0
  assert(salesAfterTotal - salesBeforeTotal === 2886, `daily sales total grew by exactly 1365+1521=2886 (got ${salesAfterTotal - salesBeforeTotal})`)
  const salesBeforeCount = (salesBefore.sections[0].summaryRow?.order_count as number) ?? 0
  const salesAfterCount = (salesAfter.sections[0].summaryRow?.order_count as number) ?? 0
  assert(salesAfterCount - salesBeforeCount === 2, 'daily sales order count grew by exactly 2')

  const taxAfter = buildTaxReport(db, today)
  const cashRateBefore = taxBefore.sections[0].rows.find((r) => r.rate_percent === 5)
  const cashRateAfter = taxAfter.sections[0].rows.find((r) => r.rate_percent === 5)
  const cardRateBefore = taxBefore.sections[0].rows.find((r) => r.rate_percent === 17)
  const cardRateAfter = taxAfter.sections[0].rows.find((r) => r.rate_percent === 17)
  const cashTaxDelta = ((cashRateAfter?.tax_collected as number) ?? 0) - ((cashRateBefore?.tax_collected as number) ?? 0)
  const cardTaxDelta = ((cardRateAfter?.tax_collected as number) ?? 0) - ((cardRateBefore?.tax_collected as number) ?? 0)
  assert(cashTaxDelta === 65, `tax report's 5% row grew by exactly 65 (got ${cashTaxDelta})`)
  assert(cardTaxDelta === 221, `tax report's 17% row grew by exactly 221 (got ${cardTaxDelta})`)

  const menuAfter = buildMenuPerformanceReport(db, today)
  const itemBefore = menuBefore.sections[0].rows.find((r) => r.item_name === 'Chicken Karahi (Updated)')
  const itemAfter = menuAfter.sections[0].rows.find((r) => r.item_name === 'Chicken Karahi (Updated)')
  const qtyDelta = ((itemAfter?.quantity_sold as number) ?? 0) - ((itemBefore?.quantity_sold as number) ?? 0)
  const revenueDelta = ((itemAfter?.revenue as number) ?? 0) - ((itemBefore?.revenue as number) ?? 0)
  assert(qtyDelta === 2, `menu performance quantity_sold grew by exactly 2 (got ${qtyDelta})`)
  assert(revenueDelta === 2600, `menu performance revenue grew by exactly 2*1300=2600 (got ${revenueDelta})`)

  const staffAfter = buildStaffReport(db, today)
  const staffBeforeRow = staffBefore.sections[0].rows.find((r) => r.staff_name === 'Charlie Cashier')
  const staffAfterRow = staffAfter.sections[0].rows.find((r) => r.staff_name === 'Charlie Cashier')
  const staffOrderDelta = ((staffAfterRow?.order_count as number) ?? 0) - ((staffBeforeRow?.order_count as number) ?? 0)
  const staffSalesDelta = ((staffAfterRow?.total_sales as number) ?? 0) - ((staffBeforeRow?.total_sales as number) ?? 0)
  assert(staffOrderDelta === 2, `staff report order count for the cashier grew by exactly 2 (got ${staffOrderDelta})`)
  assert(staffSalesDelta === 2886, `staff report total sales for the cashier grew by exactly 2886 (got ${staffSalesDelta})`)

  // Void & discount: one voided (post-kitchen) order, one discounted order.
  const voidBefore = buildVoidDiscountReport(db, today)
  const orderToVoid = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId: shift.id, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  sendToKitchen(db, orderToVoid.id)
  voidOrder(db, orderToVoid.id, 'customer cancelled', cashierId)
  const orderWithDiscount = createOrder(db, {
    type: 'TAKEAWAY',
    cashierId,
    shiftId: shift.id,
    lines: [{ itemId: menu.itemId, quantity: 1 }],
    discount: { type: 'FIXED', value: 100 }
  })
  collectPayment(db, { orderId: orderWithDiscount.id, paymentMethod: 'CASH', tenderedAmount: 2000 })
  const voidAfter = buildVoidDiscountReport(db, today)
  assert(
    voidAfter.sections[0].rows.length === voidBefore.sections[0].rows.length + 1,
    'void/discount report gained exactly one voided-order row'
  )
  assert(
    voidAfter.sections[1].rows.length === voidBefore.sections[1].rows.length + 1,
    'void/discount report gained exactly one discounted-order row'
  )
  const newDiscountRow = voidAfter.sections[1].rows.find((r) => r.order_number === orderWithDiscount.orderNumber)
  assert(newDiscountRow?.discount_amount === 100, `the new discount row shows exactly the 100 discount applied (got ${newDiscountRow?.discount_amount})`)

  // PDF/Excel rendering — real, non-trivial files with correct magic bytes.
  const salesPdf = renderReportToPdf(salesAfter)
  assert(salesPdf.length > 500, 'renderReportToPdf produces a non-trivial PDF buffer')
  assert(salesPdf.subarray(0, 4).toString('ascii') === '%PDF', 'report PDF starts with the %PDF magic bytes')

  const excelBuffer = await renderReportToExcel(salesAfter)
  // .xlsx files are ZIP archives — 'PK\x03\x04' is the ZIP local-file-header signature.
  assert(excelBuffer.length > 500, 'renderReportToExcel produces a non-trivial buffer')
  assert(excelBuffer.subarray(0, 4).toString('hex') === '504b0304', 'report Excel output starts with the ZIP/xlsx magic bytes')
}

function phase10Licensing(db: Database.Database, tmpDir: string): void {
  console.log('\n--- Phase 10: licensing ---')

  // A throwaway keypair generated in the test itself — never the app's real compiled-in public key.
  const { publicKey: testPublicKey, privateKey: testPrivateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  const { privateKey: otherPrivateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })

  const basePayload: LicensePayload = {
    licenseId: 'lic-test-1',
    restaurantName: 'Test Cafe',
    machineFingerprint: 'fingerprint-abc',
    issuedAt: new Date().toISOString(),
    expiresAt: null
  }

  const signed = signLicensePayload(basePayload, testPrivateKey)
  assert(
    verifyLicense(signed, 'fingerprint-abc', testPublicKey).valid === true,
    'a validly-signed license with a matching fingerprint and no expiry verifies'
  )

  const mutated = { payload: { ...signed.payload, restaurantName: 'Tampered Cafe' }, signature: signed.signature }
  const mutatedResult = verifyLicense(mutated, 'fingerprint-abc', testPublicKey)
  assert(
    mutatedResult.valid === false && mutatedResult.reason === 'INVALID_SIGNATURE',
    `a mutated payload field fails signature verification (got ${JSON.stringify(mutatedResult)})`
  )

  const sigBytes = Buffer.from(signed.signature, 'base64')
  sigBytes[0] ^= 0xff
  const flippedSig = { payload: signed.payload, signature: sigBytes.toString('base64') }
  const flippedResult = verifyLicense(flippedSig, 'fingerprint-abc', testPublicKey)
  assert(
    flippedResult.valid === false && flippedResult.reason === 'INVALID_SIGNATURE',
    `a single flipped signature byte fails verification (got ${JSON.stringify(flippedResult)})`
  )

  const expiredPayload: LicensePayload = { ...basePayload, expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
  const expiredSigned = signLicensePayload(expiredPayload, testPrivateKey)
  const expiredResult = verifyLicense(expiredSigned, 'fingerprint-abc', testPublicKey)
  assert(
    expiredResult.valid === false && expiredResult.reason === 'EXPIRED',
    `a validly-signed but expired license is rejected as EXPIRED, not as a bad signature (got ${JSON.stringify(expiredResult)})`
  )

  const forgedSigned = signLicensePayload(basePayload, otherPrivateKey)
  const forgedResult = verifyLicense(forgedSigned, 'fingerprint-abc', testPublicKey)
  assert(
    forgedResult.valid === false && forgedResult.reason === 'INVALID_SIGNATURE',
    `a payload signed by a different keypair (no access to the real private key) is rejected (got ${JSON.stringify(forgedResult)})`
  )

  const wrongMachineResult = verifyLicense(signed, 'a-completely-different-fingerprint', testPublicKey)
  assert(
    wrongMachineResult.valid === false && wrongMachineResult.reason === 'FINGERPRINT_MISMATCH',
    `a valid license for a different machine is rejected as FINGERPRINT_MISMATCH (got ${JSON.stringify(wrongMachineResult)})`
  )

  // Order matters: signature check must short-circuit before expiry/fingerprint are even consulted.
  const tamperedAndExpired = {
    payload: { ...expiredSigned.payload, restaurantName: 'Also Tampered' },
    signature: expiredSigned.signature
  }
  const tamperedExpiredResult = verifyLicense(tamperedAndExpired, 'fingerprint-abc', testPublicKey)
  assert(
    tamperedExpiredResult.valid === false && tamperedExpiredResult.reason === 'INVALID_SIGNATURE',
    'a payload that is both tampered AND expired is rejected for the signature, not the expiry'
  )

  // license.service.ts's non-crypto paths — activateLicense/getLicenseStatus always verify
  // against the app's real compiled-in public key, so a test-signed license can never
  // activate here by design; only the surrounding flow (not-activated, corrupt data,
  // rejection messages) is exercised without the real private key.
  const fingerprintFile = join(tmpDir, 'fingerprint.txt')
  const statusBeforeActivation = getLicenseStatus(db, fingerprintFile)
  assert(statusBeforeActivation.activated === false && statusBeforeActivation.reason === 'NOT_ACTIVATED', 'a fresh install reports NOT_ACTIVATED')
  assert(typeof statusBeforeActivation.machineFingerprint === 'string' && statusBeforeActivation.machineFingerprint.length > 0, 'a machine fingerprint is always produced')

  let threwOnGarbageLicense = false
  try {
    activateLicense(db, fingerprintFile, 'not valid json at all')
  } catch {
    threwOnGarbageLicense = true
  }
  assert(threwOnGarbageLicense, 'activateLicense rejects a file that is not valid JSON')

  let threwOnWrongKeyLicense = false
  try {
    // Signed with a test key, not the app's real one — must be rejected even though the JSON itself is well-formed.
    activateLicense(db, fingerprintFile, JSON.stringify(signed))
  } catch {
    threwOnWrongKeyLicense = true
  }
  assert(threwOnWrongKeyLicense, "activateLicense rejects a license not signed by the app's real private key")

  const fp1 = getMachineFingerprint(fingerprintFile)
  const fp2 = getMachineFingerprint(fingerprintFile)
  assert(fp1 === fp2 && fp1.length > 0, 'getMachineFingerprint is stable across repeated calls against the same fallback path')
}

async function phase11Settings(db: Database.Database): Promise<void> {
  console.log('\n--- Phase 11: settings + staff + updater ---')

  updateRestaurantSettings(db, {
    name: 'Renamed via Settings',
    address: '456 New Address',
    ntn: 'NTN-999',
    cashTaxRatePercent: 7,
    cardTaxRatePercent: 19,
    cashTaxEnabled: false,
    cardTaxEnabled: true,
    taxRoundingMethod: 'FLOOR',
    voidRequiresManagerApproval: true,
    receiptHeader: 'Welcome!',
    receiptFooter: 'Thanks for visiting!',
    rushHourMode: true
  })
  const row = db.prepare('SELECT * FROM restaurant').get() as Record<string, unknown>
  assert(row.name === 'Renamed via Settings', 'updateRestaurantSettings updates the restaurant name')
  assert(row.cash_tax_rate === 7 && row.card_tax_rate === 19, `updateRestaurantSettings updates both tax rates (got ${row.cash_tax_rate}/${row.card_tax_rate})`)
  assert(row.cash_tax_enabled === 0 && row.card_tax_enabled === 1, 'updateRestaurantSettings updates the tax-enabled flags independently')
  assert(row.tax_rounding_method === 'FLOOR', 'updateRestaurantSettings updates the rounding method')
  assert(row.void_requires_manager_approval === 1, 'updateRestaurantSettings updates the manager-approval flag')
  assert(row.receipt_header === 'Welcome!' && row.receipt_footer === 'Thanks for visiting!', 'updateRestaurantSettings updates receipt header/footer')
  assert(row.rush_hour_mode === 1, 'updateRestaurantSettings updates the rush_hour_mode flag')

  let threwOnEmptyName = false
  try {
    updateRestaurantSettings(db, {
      name: '   ',
      cashTaxRatePercent: 5,
      cardTaxRatePercent: 17,
      cashTaxEnabled: true,
      cardTaxEnabled: true,
      taxRoundingMethod: 'ROUND',
      voidRequiresManagerApproval: false,
      rushHourMode: false
    })
  } catch {
    threwOnEmptyName = true
  }
  assert(threwOnEmptyName, 'updateRestaurantSettings rejects a blank restaurant name')
  assert(
    (db.prepare('SELECT rush_hour_mode FROM restaurant').get() as { rush_hour_mode: number }).rush_hour_mode === 1,
    'the rejected update left rush_hour_mode untouched (still on from the successful update above)'
  )

  const updateResult = await checkForUpdates()
  assert(updateResult.status === 'not-configured', `checkForUpdates reports not-configured with no feed set up (got ${updateResult.status})`)
}

async function phase9BackupRestore(): Promise<void> {
  console.log('\n--- Phase 9: backup + restore ---')

  const dir = mkdtempSync(join(tmpdir(), 'dineiz-harness-backup-'))
  const dbPath = join(dir, 'live.db')
  const backupDir = join(dir, 'backups')
  let db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  db.prepare("INSERT INTO restaurant (id, name, cash_tax_rate, card_tax_rate) VALUES ('r1', 'Snapshot Cafe', 5, 17)").run()
  const backup = await createBackup(db, backupDir, 'MANUAL')
  assert(listBackups(db).length === 1, 'createBackup records exactly one row after one manual backup')
  assert(backup.trigger_type === 'MANUAL', 'the recorded backup is tagged MANUAL')

  // Simulate data added AFTER the backup was taken — this must NOT survive the restore.
  db.prepare("UPDATE restaurant SET name = 'Renamed After Backup' WHERE id = 'r1'").run()
  const nameBeforeRestore = (db.prepare('SELECT name FROM restaurant').get() as { name: string }).name
  assert(nameBeforeRestore === 'Renamed After Backup', 'the post-backup change is visible before restoring (sanity check)')

  db = await performRestore(db, backup.file_path, {
    liveDbPath: dbPath,
    backupDir,
    closeCurrentDb: () => db.close(),
    openNewDb: () => {
      const reopened = new Database(dbPath)
      reopened.pragma('journal_mode = WAL')
      reopened.pragma('foreign_keys = ON')
      return reopened
    }
  })

  const nameAfterRestore = (db.prepare('SELECT name FROM restaurant').get() as { name: string }).name
  assert(nameAfterRestore === 'Snapshot Cafe', `restore reverted the post-backup rename (got "${nameAfterRestore}")`)
  assert(
    listBackups(db).some((b) => b.trigger_type === 'PRE_RESTORE'),
    'a PRE_RESTORE safety snapshot was taken automatically before restoring'
  )
  // Exactly 1, not 2: a backup file never contains a row for itself (the row is
  // inserted after the file snapshot completes), so restoring from the MANUAL
  // backup naturally comes back with zero rows in `backups` — only the new
  // PRE_RESTORE row, recorded into the db *after* it was reopened, is present.
  assert(listBackups(db).length === 1, `restoring shows only the new PRE_RESTORE row, not the pre-restore MANUAL one (got ${listBackups(db).length})`)

  db.close()
  rmSync(dir, { recursive: true, force: true })
}

function forceJobDueNow(db: Database.Database, jobId: string): void {
  db.prepare("UPDATE print_jobs SET next_attempt_at = datetime('now', '-1 seconds') WHERE id = ?").run(jobId)
}

async function phase7Printing(
  db: Database.Database,
  shiftId: string,
  cashierId: string,
  menu: { itemId: string }
): Promise<void> {
  console.log('\n--- Phase 7: printing ---')

  // No printer configured yet: sendToKitchen/collectPayment must not throw, and nothing should be queued.
  const noPrinterOrder = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  sendToKitchen(db, noPrinterOrder.id)
  assert(listPrintJobs(db).length === 0, 'sendToKitchen with no printer configured enqueues nothing (best-effort, never throws)')

  const receiptPrinter = createPrinter(db, {
    name: 'Front Receipt',
    purpose: 'RECEIPT',
    connectionType: 'PDF_ONLY',
    isDefault: true
  })
  const kitchenPrinter = createPrinter(db, {
    name: 'Kitchen (network)',
    purpose: 'KITCHEN',
    connectionType: 'NETWORK',
    networkHost: '10.0.0.99',
    networkPort: 9100,
    isDefault: true
  })
  assert(listPrinters(db).length === 2, 'both printers were created')

  // sendToKitchen now auto-enqueues a KOT job against the default KITCHEN printer.
  const order = createOrder(db, { type: 'DINE_IN', cashierId, shiftId, lines: [{ itemId: menu.itemId, quantity: 2 }] })
  sendToKitchen(db, order.id)
  const jobsAfterSend = listPrintJobs(db)
  const kotJob = jobsAfterSend.find((j) => j.order_id === order.id && j.document_type === 'KOT')
  assert(Boolean(kotJob), 'sendToKitchen auto-enqueues a KOT print job once a kitchen printer exists')
  assert(kotJob?.printer_id === kitchenPrinter.id, 'KOT job targets the default KITCHEN printer')
  const kotPayload = JSON.parse(kotJob!.payload_json) as ReceiptDocument
  const kotText = JSON.stringify(kotPayload)
  assert(!/"2500"|"5000"/.test(kotText), 'the enqueued KOT payload contains no price-shaped values')

  // Rush Hour Mode: with the restaurant flag on, sendToKitchen enqueues a second job —
  // an itemized, unpaid order ticket (the same due-bill document "Print bill" produces) —
  // alongside the KOT, so the counter/runner gets a priced copy without waiting on the
  // kitchen. Toggled directly via SQL here; the settings-service round trip that flips
  // this column from the renderer is covered separately in Phase 11.
  db.prepare('UPDATE restaurant SET rush_hour_mode = 1').run()
  const rushOrder = createOrder(db, { type: 'DINE_IN', cashierId, shiftId, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  sendToKitchen(db, rushOrder.id)
  const rushJobs = listPrintJobs(db).filter((j) => j.order_id === rushOrder.id)
  assert(rushJobs.length === 2, `Rush Hour Mode: sendToKitchen enqueues exactly 2 print jobs (got ${rushJobs.length})`)
  const rushKot = rushJobs.find((j) => j.document_type === 'KOT')
  const rushReceipt = rushJobs.find((j) => j.document_type === 'RECEIPT')
  assert(Boolean(rushKot) && rushKot?.printer_id === kitchenPrinter.id, 'Rush Hour Mode still sends the KOT to the default KITCHEN printer')
  assert(Boolean(rushReceipt), 'Rush Hour Mode additionally enqueues a RECEIPT job (the priced order ticket)')
  assert(rushReceipt?.printer_id === receiptPrinter.id, 'Rush Hour Mode order-ticket job targets the default RECEIPT printer')
  const rushReceiptText = JSON.stringify(JSON.parse(rushReceipt!.payload_json) as ReceiptDocument)
  assert(rushReceiptText.includes('TOTAL DUE'), 'Rush Hour Mode order-ticket is the unpaid due-bill variant ("TOTAL DUE", not "TOTAL")')
  assert(/Price|Amount/.test(rushReceiptText), 'Rush Hour Mode order-ticket carries priced item columns, unlike the KOT')

  // The flag genuinely gates the behavior — off again, sendToKitchen goes back to one job.
  db.prepare('UPDATE restaurant SET rush_hour_mode = 0').run()
  const noRushOrder = createOrder(db, { type: 'DINE_IN', cashierId, shiftId, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  sendToKitchen(db, noRushOrder.id)
  const noRushJobs = listPrintJobs(db).filter((j) => j.order_id === noRushOrder.id)
  assert(
    noRushJobs.length === 1 && noRushJobs[0].document_type === 'KOT',
    `Rush Hour Mode off: sendToKitchen is back to enqueueing only the KOT (got ${noRushJobs.length} job(s))`
  )

  // Voiding an item on a PENDING order (never sent to kitchen) must not print a cancellation KOT.
  const pendingOrder = createOrder(db, { type: 'TAKEAWAY', cashierId, shiftId, lines: [{ itemId: menu.itemId, quantity: 1 }] })
  const pendingItemId = getOrder(db, pendingOrder.id)!.items[0].id
  const jobCountBeforePendingVoid = listPrintJobs(db).length
  voidOrderItem(db, pendingOrder.id, pendingItemId, 'changed mind', cashierId, true)
  assert(
    listPrintJobs(db).length === jobCountBeforePendingVoid,
    'voiding an item on a PENDING (never-sent) order does not enqueue a cancellation KOT'
  )

  // Voiding an item on an already-IN_KITCHEN order must print a cancellation KOT.
  const twoItemOrder = createOrder(db, {
    type: 'DINE_IN',
    cashierId,
    shiftId,
    lines: [
      { itemId: menu.itemId, quantity: 1 },
      { itemId: menu.itemId, quantity: 1 }
    ]
  })
  sendToKitchen(db, twoItemOrder.id)
  const jobCountBeforeVoid = listPrintJobs(db).length
  const itemToVoid = getOrder(db, twoItemOrder.id)!.items[0].id
  voidOrderItem(db, twoItemOrder.id, itemToVoid, 'wrong item', cashierId, true)
  const cancelJob = listPrintJobs(db).find((j) => j.order_id === twoItemOrder.id && j.document_type === 'CANCELLATION_KOT')
  assert(Boolean(cancelJob), 'voiding an item on an IN_KITCHEN order enqueues a CANCELLATION_KOT')
  assert(listPrintJobs(db).length === jobCountBeforeVoid + 1, 'exactly one cancellation KOT job was added')

  // collectPayment auto-enqueues a RECEIPT job against the default RECEIPT printer.
  const payResult = collectPayment(db, { orderId: twoItemOrder.id, paymentMethod: 'CASH', tenderedAmount: 100000 })
  assert(payResult.order.status === 'COMPLETED', 'order paid successfully ahead of the receipt-print check')
  const receiptJob = listPrintJobs(db).find((j) => j.order_id === twoItemOrder.id && j.document_type === 'RECEIPT')
  assert(Boolean(receiptJob), 'collectPayment auto-enqueues a RECEIPT print job')
  assert(receiptJob?.printer_id === receiptPrinter.id, 'RECEIPT job targets the default RECEIPT printer')

  // NTN and custom receipt header/footer text are settings a restaurant can
  // fill in (Settings screen) — confirm they actually reach a real printed
  // receipt end-to-end from a real SQLite row, not just at the pos-logic
  // unit-test level. Set directly via SQL (the settings-service round trip
  // through the renderer is Phase 11's concern) so this test is self-
  // contained regardless of what Phase 11 does later in the same run.
  db.prepare("UPDATE restaurant SET ntn = 'NTN-778899', receipt_header = 'Welcome to Kababjees!', receipt_footer = 'Thank you, visit again!'").run()
  const brandedPrintOrder = buildPrintOrder(db, twoItemOrder.id)
  assert(brandedPrintOrder.restaurantNtn === 'NTN-778899', 'buildPrintOrder reads the restaurant NTN from the db')
  assert(brandedPrintOrder.receiptHeader === 'Welcome to Kababjees!', 'buildPrintOrder reads the custom receipt header from the db')
  assert(brandedPrintOrder.receiptFooter === 'Thank you, visit again!', 'buildPrintOrder reads the custom receipt footer from the db')

  const brandedBillDoc = buildBillDocument(brandedPrintOrder, { isPaid: true })
  const brandedBillText = JSON.stringify(brandedBillDoc)
  assert(brandedBillText.includes('NTN-778899'), 'the printed RECEIPT document includes the restaurant NTN')
  assert(brandedBillText.includes('Welcome to Kababjees!'), 'the printed RECEIPT document includes the custom header')
  assert(brandedBillText.includes('Thank you, visit again!'), 'the printed RECEIPT document includes the custom footer')
  assert(brandedBillText.includes('Powered by Dineiz'), 'every RECEIPT document ends with a Powered by Dineiz line, custom footer or not')

  // Actually render this exact branded receipt to a real PDF file and save it
  // where it can be opened and visually inspected — the same discipline used
  // for every other generated-file check in this harness (reports, backups).
  const brandedReceiptPdf = renderReceiptToPdf(brandedBillDoc)
  const brandedReceiptPdfPath = join(tmpdir(), 'dineiz-harness-branded-receipt.pdf')
  writeFileSync(brandedReceiptPdfPath, brandedReceiptPdf)
  console.log(`  (branded receipt PDF written to ${brandedReceiptPdfPath} for visual inspection)`)

  // PDF rendering produces a real, non-trivial PDF file (starts with the %PDF magic bytes).
  const pdfBuffer = renderReceiptToPdf(buildKotDocument({
    orderNumber: 'ORD-TEST',
    type: 'DINE_IN',
    restaurantName: 'Test Cafe',
    items: [{ name: 'Chicken Karahi', quantity: 1, unitPrice: 1300, subtotal: 1300 }],
    subtotal: 1300,
    discountAmount: 0,
    taxAmount: 65,
    taxRatePercent: 5,
    total: 1365,
    createdAt: new Date().toISOString()
  }))
  assert(pdfBuffer.length > 100, 'renderReceiptToPdf produces a non-trivial PDF buffer')
  assert(pdfBuffer.subarray(0, 4).toString('ascii') === '%PDF', 'renderReceiptToPdf output starts with the %PDF magic bytes')

  // Regression guard for a real bug found and fixed this session: jsPDF's
  // 'portrait' orientation silently swaps an explicit format:[w,h] array
  // whenever width > height — true for almost any short KOT/receipt on
  // 80mm paper, since a handful of lines rarely add up to 226.77pt of
  // height. The swap left every pageWidthPt-relative draw call (centering,
  // right-alignment, the footer logo) positioned for a page that no longer
  // existed, rendering most content outside the actual (transposed) page.
  // Confirmed by reading the page's own /MediaBox back out of the PDF
  // bytes — this is a short single-item KOT, guaranteed width > height, so
  // it reproduces the exact shape that triggered the bug.
  const mediaBoxMatch = pdfBuffer
    .toString('latin1')
    .match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/)
  assert(Boolean(mediaBoxMatch), 'the PDF has a readable /MediaBox to check page dimensions against')
  const [pdfPageWidth, pdfPageHeight] = [Number(mediaBoxMatch![1]), Number(mediaBoxMatch![2])]
  assert(
    pdfPageWidth > pdfPageHeight,
    `a short 80mm-wide KOT stays landscape-shaped (wider than tall), not silently transposed by jsPDF (got ${pdfPageWidth}x${pdfPageHeight})`
  )

  // Regression guard for the other bug found alongside it: a two-col line's
  // right column (a KOT item name, unlike a bill's short money values) can
  // be too wide to fit next to its qty on one line and must wrap onto
  // additional lines rather than running off the page edge. A long name
  // should make the PDF measurably taller than an otherwise-identical KOT
  // with a short one-line name, proving the extra content became extra
  // height instead of being silently clipped or overlapping.
  const shortNameKot = renderReceiptToPdf(
    buildKotDocument({
      orderNumber: 'ORD-WRAP-1',
      type: 'TAKEAWAY',
      restaurantName: 'Test Cafe',
      items: [{ name: 'Fries', quantity: 1, unitPrice: 200, subtotal: 200 }],
      subtotal: 200,
      discountAmount: 0,
      taxAmount: 0,
      taxRatePercent: 0,
      total: 200,
      createdAt: new Date().toISOString()
    })
  )
  const longNameKot = renderReceiptToPdf(
    buildKotDocument({
      orderNumber: 'ORD-WRAP-2',
      type: 'TAKEAWAY',
      restaurantName: 'Test Cafe',
      items: [
        {
          name: 'Zinger Burger with Extra Cheese, Extra Mayo, and a Large Fries Combo Meal',
          quantity: 1,
          unitPrice: 200,
          subtotal: 200
        }
      ],
      subtotal: 200,
      discountAmount: 0,
      taxAmount: 0,
      taxRatePercent: 0,
      total: 200,
      createdAt: new Date().toISOString()
    })
  )
  const heightOf = (buf: Buffer): number =>
    Number(buf.toString('latin1').match(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)\s*\]/)![1])
  assert(
    heightOf(longNameKot) > heightOf(shortNameKot),
    'a KOT item name too long to fit next to its qty wraps onto extra lines (taller PDF), rather than overflowing the page edge'
  )

  // Retry/backoff/dead-letter, driven by a fake transport (no real printer needed). The queue
  // is shared with the still-PENDING jobs enqueued above (never processed by a real dispatch),
  // so the fake must only simulate failure for the specific job under test here and let anything
  // else in the queue succeed immediately — otherwise those unrelated jobs' own retries would
  // pollute this test's dispatch-call count.
  let dispatchCallsForTestJob = 0
  let shouldSucceed = false
  let testJobId = ''
  const fakeDispatch: typeof import('../src/main/printing/printerTransport').dispatchPrintJob = async (
    _printer: PrinterConfig,
    _doc,
    _savedPdfDir,
    fileNameHint: string
  ) => {
    if (fileNameHint !== `kot-${testJobId}`) return // an unrelated pre-existing job — let it drain harmlessly
    dispatchCallsForTestJob += 1
    if (!shouldSucceed) throw new Error('simulated printer offline')
  }

  testJobId = enqueuePrintJob(db, {
    printerId: kitchenPrinter.id,
    documentType: 'KOT',
    orderId: null,
    document: buildKotDocument({
      orderNumber: 'ORD-RETRY-TEST',
      type: 'TAKEAWAY',
      restaurantName: 'Test Cafe',
      items: [{ name: 'Test Item', quantity: 1, unitPrice: 100, subtotal: 100 }],
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 0,
      taxRatePercent: 0,
      total: 100,
      createdAt: new Date().toISOString()
    })
  })

  const savedPdfDir = join(tmpdir(), 'dineiz-harness-pdfs')

  await processQueueOnce(db, { dispatch: fakeDispatch, savedPdfDir })
  let job = listPrintJobs(db).find((j) => j.id === testJobId)!
  assert(job.status === 'FAILED' && job.attempts === 1, `attempt 1 fails and schedules a retry (got status=${job.status}, attempts=${job.attempts})`)
  // Compare against SQLite's own now() (both naive UTC strings) rather than a JS Date — mixing
  // SQLite's timezone-less UTC string with JS's local-time string parsing would misreport the
  // difference by this machine's UTC offset.
  const sqliteNow = (db.prepare("SELECT datetime('now') AS now").get() as { now: string }).now
  assert(job.next_attempt_at > sqliteNow, 'next_attempt_at was pushed into the future after a failure')

  // Fast-forward through the remaining attempts without a real wait.
  for (let i = 2; i <= job.max_attempts; i++) {
    forceJobDueNow(db, testJobId)
    await processQueueOnce(db, { dispatch: fakeDispatch, savedPdfDir })
  }
  job = listPrintJobs(db).find((j) => j.id === testJobId)!
  assert(job.status === 'DEAD_LETTER', `job is dead-lettered after ${job.max_attempts} failed attempts (got ${job.status})`)
  assert(
    dispatchCallsForTestJob === job.max_attempts,
    `dispatch was attempted exactly max_attempts (${job.max_attempts}) times (got ${dispatchCallsForTestJob})`
  )

  retryDeadLetter(db, testJobId)
  job = listPrintJobs(db).find((j) => j.id === testJobId)!
  assert(job.status === 'PENDING' && job.attempts === 0, 'retryDeadLetter resets a dead-lettered job to PENDING with attempts=0')

  shouldSucceed = true
  await processQueueOnce(db, { dispatch: fakeDispatch, savedPdfDir })
  job = listPrintJobs(db).find((j) => j.id === testJobId)!
  assert(job.status === 'SUCCEEDED', 'job succeeds once the (fake) printer comes back online')

  let threwOnDeletingPrinterWithHistory = false
  try {
    deletePrinter(db, kitchenPrinter.id)
  } catch {
    threwOnDeletingPrinterWithHistory = true
  }
  assert(threwOnDeletingPrinterWithHistory, 'deletePrinter refuses to delete a printer that has print job history')
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'dineiz-harness-'))
  const dbPath = join(dir, 'test.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const { cashierId } = phase3SetupAndAuth(db)
  const shift = openShift(db, cashierId, 5000)
  const menu = phase4Menu(db, shift.id, cashierId)
  phase4bTables(db, shift.id, cashierId, menu)
  const { orderId } = phase5Orders(db, shift.id, cashierId, menu)
  phase6Payments(db, orderId, shift.id, cashierId, menu)
  await phase7Printing(db, shift.id, cashierId, menu)
  phase8Shifts(db, shift.id, cashierId, menu)
  await phase9Reports(db, cashierId, menu)
  phase10Licensing(db, dir)
  await phase11Settings(db)

  db.close()
  rmSync(dir, { recursive: true, force: true })

  await phase9BackupRestore()

  console.log(failures === 0 ? '\nHARNESS PASSED' : `\nHARNESS FAILED (${failures} assertion(s))`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
