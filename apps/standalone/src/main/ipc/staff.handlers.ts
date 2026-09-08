import type { IpcMain } from 'electron'
import type { UserRole } from '@dineiz/pos-logic'
import { getDb } from '../db'
import { changePassword, changePin, createUser, listAllStaff, setUserActive } from '../services/auth.service'

export function registerStaffHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('staff:listAll', () => listAllStaff(getDb()))
  ipcMain.handle(
    'staff:create',
    (_e, input: { name: string; role: UserRole; email?: string; password?: string; pin?: string }) =>
      createUser(getDb(), input)
  )
  ipcMain.handle('staff:setActive', (_e, input: { userId: string; isActive: boolean }) =>
    setUserActive(getDb(), input.userId, input.isActive)
  )
  ipcMain.handle('staff:changePassword', (_e, input: { userId: string; newPassword: string }) =>
    changePassword(getDb(), input.userId, input.newPassword)
  )
  ipcMain.handle('staff:changePin', (_e, input: { userId: string; newPin: string }) =>
    changePin(getDb(), input.userId, input.newPin)
  )
}
