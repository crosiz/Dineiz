import type { IpcMain } from 'electron'
import { getDb } from '../db'
import {
  createOrder,
  getOrder,
  listActive,
  markReady,
  sendToKitchen,
  voidOrder,
  voidOrderItem,
  type CreateOrderInput
} from '../services/orders.service'

export function registerOrderHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('orders:create', (_e, input: CreateOrderInput) => createOrder(getDb(), input))
  ipcMain.handle('orders:sendToKitchen', (_e, input: { orderId: string }) => sendToKitchen(getDb(), input.orderId))
  ipcMain.handle('orders:markReady', (_e, input: { orderId: string }) => markReady(getDb(), input.orderId))
  ipcMain.handle('orders:void', (_e, input: { orderId: string; reason: string; userId: string }) =>
    voidOrder(getDb(), input.orderId, input.reason, input.userId)
  )
  ipcMain.handle(
    'orders:voidItem',
    (
      _e,
      input: { orderId: string; orderItemId: string; reason: string; userId: string; managerApproved: boolean }
    ) => voidOrderItem(getDb(), input.orderId, input.orderItemId, input.reason, input.userId, input.managerApproved)
  )
  ipcMain.handle('orders:listActive', () => listActive(getDb()))
  ipcMain.handle('orders:get', (_e, input: { id: string }) => getOrder(getDb(), input.id))
}
