import type { IpcMain } from 'electron'
import { backupDir, getDb, restoreFromBackup } from '../db'
import { createBackup, deleteBackup, getBackup, listBackups } from '../services/backup.service'

export function registerBackupHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('backups:list', () => listBackups(getDb()))
  ipcMain.handle('backups:create', () => createBackup(getDb(), backupDir(), 'MANUAL'))
  ipcMain.handle('backups:delete', (_e, input: { id: string }) => deleteBackup(getDb(), input.id))
  ipcMain.handle('backups:restore', async (_e, input: { id: string }) => {
    const backup = getBackup(getDb(), input.id)
    await restoreFromBackup(backup.file_path)
  })
}
