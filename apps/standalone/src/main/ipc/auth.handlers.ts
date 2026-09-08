import type { IpcMain } from 'electron'
import { getDb } from '../db'
import { listActiveStaff, login } from '../services/auth.service'

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('auth:listActiveStaff', () => {
    return listActiveStaff(getDb())
  })

  ipcMain.handle('auth:login', (_event, input: { userId: string; password?: string; pin?: string }) => {
    return login(getDb(), input)
  })
}
