import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { backupDir, getDb, initDatabase } from './db'
import { registerIpcHandlers } from './ipc/handlers'
import { registerSetupHandlers } from './ipc/setup.handlers'
import { registerAuthHandlers } from './ipc/auth.handlers'
import { registerMenuHandlers } from './ipc/menu.handlers'
import { registerTableHandlers } from './ipc/tables.handlers'
import { registerOrderHandlers } from './ipc/orders.handlers'
import { registerShiftHandlers } from './ipc/shifts.handlers'
import { registerPaymentHandlers } from './ipc/payments.handlers'
import { registerPrintingHandlers } from './ipc/printing.handlers'
import { registerReportHandlers } from './ipc/reports.handlers'
import { registerBackupHandlers } from './ipc/backup.handlers'
import { registerLicensingHandlers } from './ipc/licensing.handlers'
import { registerStaffHandlers } from './ipc/staff.handlers'
import { processQueueOnce } from './printing/printQueue'
import { maybeRunScheduledBackups } from './services/backup.service'

const PRINT_QUEUE_POLL_MS = 5_000
const BACKUP_SCHEDULE_CHECK_MS = 5 * 60_000

// Electron derives getPath('userData') from this name — must be set before
// any window or db access so the on-disk location matches the documented
// C:\Users\<name>\AppData\Roaming\Dineiz\dineiz.db path.
app.setName('Dineiz')

const isDev = !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // Packaged Windows/macOS builds get their icon from electron-builder's
    // own win.icon/mac.icon (build/icon.ico, stamped into the .exe itself
    // via rcedit at build time) — the OS shows that regardless of this
    // option. This is only for the *dev* window, which otherwise shows
    // Electron's generic default icon: build/ isn't part of the packaged
    // app's bundled files, so this relative path only resolves during
    // development, when it's read straight off the source tree.
    ...(isDev ? { icon: join(__dirname, '../../build/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers(ipcMain)
  registerSetupHandlers(ipcMain)
  registerAuthHandlers(ipcMain)
  registerMenuHandlers(ipcMain)
  registerTableHandlers(ipcMain)
  registerOrderHandlers(ipcMain)
  registerShiftHandlers(ipcMain)
  registerPaymentHandlers(ipcMain)
  registerPrintingHandlers(ipcMain)
  registerReportHandlers(ipcMain)
  registerBackupHandlers(ipcMain)
  registerLicensingHandlers(ipcMain)
  registerStaffHandlers(ipcMain)
  createWindow()

  const savedPdfDir = join(app.getPath('userData'), 'receipts')
  setInterval(() => {
    processQueueOnce(getDb(), { savedPdfDir }).catch((err) => console.error('[print queue] poll failed', err))
  }, PRINT_QUEUE_POLL_MS)

  setInterval(() => {
    maybeRunScheduledBackups(getDb(), backupDir()).catch((err) => console.error('[backup] scheduled check failed', err))
  }, BACKUP_SCHEDULE_CHECK_MS)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
