import type { IpcMain } from 'electron'
import { app, shell } from 'electron'
import { join } from 'node:path'
import { getDb } from '../db'
import { generateReportData, type ReportRequest } from '../reports/reports.service'
import { exportReport, type ReportFormat } from '../reports/exportReport'

function reportsDir(): string {
  return join(app.getPath('userData'), 'reports')
}

export function registerReportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('reports:generate', (_e, input: ReportRequest) => generateReportData(getDb(), input))

  ipcMain.handle('reports:export', async (_e, input: { request: ReportRequest; format: ReportFormat }) => {
    const { filePath } = await exportReport(getDb(), input.request, input.format, reportsDir())
    return { filePath }
  })

  ipcMain.handle('reports:openFile', async (_e, input: { filePath: string }) => {
    const errorMessage = await shell.openPath(input.filePath)
    if (errorMessage) throw new Error(errorMessage)
  })
}
