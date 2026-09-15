import type { IpcMain } from 'electron'
import { app, dialog } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from '../db'
import { activateLicense, getLicenseStatus } from '../licensing/license.service'

function fingerprintFilePath(): string {
  return join(app.getPath('userData'), 'machine-fingerprint.txt')
}

export function registerLicensingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('licensing:getStatus', () => getLicenseStatus(getDb(), fingerprintFilePath()))

  ipcMain.handle('licensing:importAndActivate', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select your Dineiz license file',
      filters: [{ name: 'License files', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const content = await readFile(result.filePaths[0], 'utf-8')
    return activateLicense(getDb(), fingerprintFilePath(), content)
  })
}
