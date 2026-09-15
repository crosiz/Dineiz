import type { IpcMain } from 'electron'
import { getDb } from '../db'
import { completeSetup, isSetupComplete, type SetupInput } from '../services/setup.service'

export function registerSetupHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('setup:getStatus', () => {
    return { isComplete: isSetupComplete(getDb()) }
  })

  ipcMain.handle('setup:complete', (_event, input: SetupInput) => {
    return completeSetup(getDb(), input)
  })
}
