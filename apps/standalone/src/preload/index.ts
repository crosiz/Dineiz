import { contextBridge, ipcRenderer } from 'electron'
import type { RestaurantRow } from '../main/ipc/handlers'
import type { SetupInput, SetupResult } from '../main/services/setup.service'
import type { AuthResult, StaffSummary } from '../main/services/auth.service'
import type { CategoryWithItems, CreateItemInput, UpdateItemInput } from '../main/services/menu.service'
import type {
  CreateTableInput,
  FloorWithTables,
  TableStatus,
  UpdateTableInput
} from '../main/services/tables.service'
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderSummary
} from '../main/services/orders.service'
import type {
  CloseShiftInput,
  CloseShiftResult,
  RecordActivityInput,
  ShiftActivityRow,
  ShiftReportData,
  ShiftSummary
} from '../main/services/shifts.service'
import type { CollectPaymentInput, CollectPaymentResult } from '../main/services/payments.service'
import type { PrinterRow, UpsertPrinterInput } from '../main/services/printers.service'
import type { PrintJobRow, PrintJobStatus, ProcessQueueResult } from '../main/printing/printQueue'
import type { BackupRow } from '../main/services/backup.service'
import type { ReportData, ReportRequest } from '../main/reports/reports.service'
import type { ReportFormat } from '../main/reports/exportReport'
import type { LicenseStatus } from '../main/licensing/license.service'
import type { UpdateRestaurantSettingsInput } from '../main/services/settings.service'
import type { UpdateCheckResult } from '../main/updater/autoUpdate'
import type { UserRole } from '@dineiz/pos-logic'

const api = {
  app: {
    ping: (): Promise<{ ok: boolean; at: string }> => ipcRenderer.invoke('app:ping'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('app:checkForUpdates')
  },
  restaurant: {
    get: (): Promise<RestaurantRow | null> => ipcRenderer.invoke('restaurant:get'),
    updateSettings: (input: UpdateRestaurantSettingsInput): Promise<void> =>
      ipcRenderer.invoke('restaurant:updateSettings', input)
  },
  setup: {
    getStatus: (): Promise<{ isComplete: boolean }> => ipcRenderer.invoke('setup:getStatus'),
    complete: (input: SetupInput): Promise<SetupResult> => ipcRenderer.invoke('setup:complete', input)
  },
  auth: {
    listActiveStaff: (): Promise<StaffSummary[]> => ipcRenderer.invoke('auth:listActiveStaff'),
    login: (input: { userId: string; password?: string; pin?: string }): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:login', input),
    resetOwnerPasswordWithRecoveryCode: (input: { userId: string; recoveryCode: string; newPassword: string }): Promise<void> =>
      ipcRenderer.invoke('auth:resetOwnerPasswordWithRecoveryCode', input)
  },
  menu: {
    getAll: (): Promise<{ categories: CategoryWithItems[] }> => ipcRenderer.invoke('menu:getAll'),
    createCategory: (input: { name: string; sortOrder?: number }): Promise<{ id: string }> =>
      ipcRenderer.invoke('menu:createCategory', input),
    updateCategory: (input: { id: string; name?: string; sortOrder?: number }): Promise<void> =>
      ipcRenderer.invoke('menu:updateCategory', input),
    deleteCategory: (input: { id: string }): Promise<void> => ipcRenderer.invoke('menu:deleteCategory', input),
    reorderCategories: (input: { orderedIds: string[] }): Promise<void> =>
      ipcRenderer.invoke('menu:reorderCategories', input),

    createItem: (input: CreateItemInput): Promise<{ id: string }> => ipcRenderer.invoke('menu:createItem', input),
    updateItem: (input: { id: string } & UpdateItemInput): Promise<void> =>
      ipcRenderer.invoke('menu:updateItem', input),
    setItemAvailability: (input: { id: string; isAvailable: boolean }): Promise<void> =>
      ipcRenderer.invoke('menu:setItemAvailability', input),
    deleteItem: (input: { id: string }): Promise<void> => ipcRenderer.invoke('menu:deleteItem', input),

    createVariation: (input: {
      itemId: string
      name: string
      price: number
      sortOrder?: number
    }): Promise<{ id: string }> => ipcRenderer.invoke('menu:createVariation', input),
    updateVariation: (input: { id: string; name?: string; price?: number; sortOrder?: number }): Promise<void> =>
      ipcRenderer.invoke('menu:updateVariation', input),
    deleteVariation: (input: { id: string }): Promise<void> => ipcRenderer.invoke('menu:deleteVariation', input),

    createAddon: (input: {
      itemId: string
      name: string
      price: number
      sortOrder?: number
    }): Promise<{ id: string }> => ipcRenderer.invoke('menu:createAddon', input),
    updateAddon: (input: { id: string; name?: string; price?: number; sortOrder?: number }): Promise<void> =>
      ipcRenderer.invoke('menu:updateAddon', input),
    deleteAddon: (input: { id: string }): Promise<void> => ipcRenderer.invoke('menu:deleteAddon', input)
  },
  tables: {
    getAll: (): Promise<{ floors: FloorWithTables[] }> => ipcRenderer.invoke('tables:getAll'),
    createFloor: (input: { name: string; sortOrder?: number }): Promise<{ id: string }> =>
      ipcRenderer.invoke('tables:createFloor', input),
    renameFloor: (input: { id: string; name: string }): Promise<void> =>
      ipcRenderer.invoke('tables:renameFloor', input),
    deleteFloor: (input: { id: string }): Promise<void> => ipcRenderer.invoke('tables:deleteFloor', input),

    createTable: (input: CreateTableInput): Promise<{ id: string }> => ipcRenderer.invoke('tables:createTable', input),
    updateTable: (input: { id: string } & UpdateTableInput): Promise<void> =>
      ipcRenderer.invoke('tables:updateTable', input),
    setStatus: (input: { id: string; status: TableStatus }): Promise<void> =>
      ipcRenderer.invoke('tables:setStatus', input),
    deleteTable: (input: { id: string }): Promise<void> => ipcRenderer.invoke('tables:deleteTable', input)
  },
  orders: {
    create: (input: CreateOrderInput): Promise<CreateOrderResult> => ipcRenderer.invoke('orders:create', input),
    sendToKitchen: (input: { orderId: string }): Promise<void> => ipcRenderer.invoke('orders:sendToKitchen', input),
    markReady: (input: { orderId: string }): Promise<void> => ipcRenderer.invoke('orders:markReady', input),
    void: (input: { orderId: string; reason: string; userId: string }): Promise<void> =>
      ipcRenderer.invoke('orders:void', input),
    voidItem: (input: {
      orderId: string
      orderItemId: string
      reason: string
      userId: string
      managerApproved: boolean
    }): Promise<void> => ipcRenderer.invoke('orders:voidItem', input),
    listActive: (): Promise<OrderSummary[]> => ipcRenderer.invoke('orders:listActive'),
    get: (input: { id: string }): Promise<OrderSummary | null> => ipcRenderer.invoke('orders:get', input)
  },
  shifts: {
    getOpen: (): Promise<ShiftSummary | null> => ipcRenderer.invoke('shifts:getOpen'),
    open: (input: { cashierId: string; openingFloat: number }): Promise<ShiftSummary> =>
      ipcRenderer.invoke('shifts:open', input),
    recordActivity: (input: RecordActivityInput): Promise<void> => ipcRenderer.invoke('shifts:recordActivity', input),
    listActivities: (input: { shiftId: string }): Promise<ShiftActivityRow[]> =>
      ipcRenderer.invoke('shifts:listActivities', input),
    close: (input: CloseShiftInput): Promise<CloseShiftResult> => ipcRenderer.invoke('shifts:close', input),
    report: (input: { shiftId: string }): Promise<ShiftReportData> => ipcRenderer.invoke('shifts:report', input)
  },
  payments: {
    collect: (input: CollectPaymentInput): Promise<CollectPaymentResult> =>
      ipcRenderer.invoke('payments:collect', input)
  },
  printers: {
    list: (): Promise<PrinterRow[]> => ipcRenderer.invoke('printers:list'),
    create: (input: UpsertPrinterInput): Promise<{ id: string }> => ipcRenderer.invoke('printers:create', input),
    update: (input: { id: string } & UpsertPrinterInput): Promise<void> =>
      ipcRenderer.invoke('printers:update', input),
    delete: (input: { id: string }): Promise<void> => ipcRenderer.invoke('printers:delete', input),
    listOsPrinters: (): Promise<string[]> => ipcRenderer.invoke('printers:listOsPrinters')
  },
  printJobs: {
    list: (input?: { status?: PrintJobStatus }): Promise<PrintJobRow[]> => ipcRenderer.invoke('printJobs:list', input),
    retry: (input: { jobId: string }): Promise<void> => ipcRenderer.invoke('printJobs:retry', input),
    processNow: (): Promise<ProcessQueueResult> => ipcRenderer.invoke('printJobs:processNow'),
    reprintReceipt: (input: { orderId: string; printerId: string; isPaid: boolean }): Promise<string> =>
      ipcRenderer.invoke('printJobs:reprintReceipt', input),
    reprintKot: (input: { orderId: string; printerId: string }): Promise<string> =>
      ipcRenderer.invoke('printJobs:reprintKot', input)
  },
  reports: {
    generate: (input: ReportRequest): Promise<ReportData> => ipcRenderer.invoke('reports:generate', input),
    export: (input: { request: ReportRequest; format: ReportFormat }): Promise<{ filePath: string }> =>
      ipcRenderer.invoke('reports:export', input),
    openFile: (input: { filePath: string }): Promise<void> => ipcRenderer.invoke('reports:openFile', input)
  },
  backups: {
    list: (): Promise<BackupRow[]> => ipcRenderer.invoke('backups:list'),
    create: (): Promise<BackupRow> => ipcRenderer.invoke('backups:create'),
    delete: (input: { id: string }): Promise<void> => ipcRenderer.invoke('backups:delete', input),
    restore: (input: { id: string }): Promise<void> => ipcRenderer.invoke('backups:restore', input)
  },
  licensing: {
    getStatus: (): Promise<LicenseStatus> => ipcRenderer.invoke('licensing:getStatus'),
    importAndActivate: (): Promise<LicenseStatus | null> => ipcRenderer.invoke('licensing:importAndActivate')
  },
  staff: {
    listAll: (): Promise<StaffSummary[]> => ipcRenderer.invoke('staff:listAll'),
    create: (input: { name: string; role: UserRole; email?: string; password?: string; pin?: string }): Promise<StaffSummary> =>
      ipcRenderer.invoke('staff:create', input),
    setActive: (input: { userId: string; isActive: boolean }): Promise<void> =>
      ipcRenderer.invoke('staff:setActive', input),
    changePassword: (input: { userId: string; newPassword: string }): Promise<void> =>
      ipcRenderer.invoke('staff:changePassword', input),
    changePin: (input: { userId: string; newPin: string }): Promise<void> =>
      ipcRenderer.invoke('staff:changePin', input)
  }
}

export type DineizApi = typeof api

contextBridge.exposeInMainWorld('dineiz', api)
