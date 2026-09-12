import type { IpcMain } from 'electron'
import { backupDir, getDb } from '../db'
import { createBackup } from '../services/backup.service'
import {
  buildShiftReportData,
  closeShift,
  getOpenShift,
  listActivities,
  openShift,
  recordActivity,
  type CloseShiftInput,
  type RecordActivityInput
} from '../services/shifts.service'

export function registerShiftHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('shifts:getOpen', () => getOpenShift(getDb()))

  ipcMain.handle('shifts:open', (_e, input: { cashierId: string; openingFloat: number }) =>
    openShift(getDb(), input.cashierId, input.openingFloat)
  )

  ipcMain.handle('shifts:recordActivity', (_e, input: RecordActivityInput) => recordActivity(getDb(), input))
  ipcMain.handle('shifts:listActivities', (_e, input: { shiftId: string }) => listActivities(getDb(), input.shiftId))

  ipcMain.handle('shifts:close', (_e, input: CloseShiftInput) => {
    const result = closeShift(getDb(), input)
    // Best-effort, matching autoprint's philosophy: a failed backup must never undo a successful shift close.
    createBackup(getDb(), backupDir(), 'SHIFT_CLOSE').catch((err) => console.error('[backup] shift-close backup failed', err))
    return result
  })

  ipcMain.handle('shifts:report', (_e, input: { shiftId: string }) => buildShiftReportData(getDb(), input.shiftId))
}
