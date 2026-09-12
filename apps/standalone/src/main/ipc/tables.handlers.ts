import type { IpcMain } from 'electron'
import { getDb } from '../db'
import {
  createFloor,
  createTable,
  deleteFloor,
  deleteTable,
  getFullFloorPlan,
  renameFloor,
  setTableStatus,
  updateTable,
  type CreateTableInput,
  type TableStatus,
  type UpdateTableInput
} from '../services/tables.service'

export function registerTableHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('tables:getAll', () => getFullFloorPlan(getDb()))

  ipcMain.handle('tables:createFloor', (_e, input: { name: string; sortOrder?: number }) =>
    createFloor(getDb(), input)
  )
  ipcMain.handle('tables:renameFloor', (_e, input: { id: string; name: string }) => {
    renameFloor(getDb(), input.id, input.name)
  })
  ipcMain.handle('tables:deleteFloor', (_e, input: { id: string }) => {
    deleteFloor(getDb(), input.id)
  })

  ipcMain.handle('tables:createTable', (_e, input: CreateTableInput) => createTable(getDb(), input))
  ipcMain.handle('tables:updateTable', (_e, input: { id: string } & UpdateTableInput) => {
    updateTable(getDb(), input.id, input)
  })
  ipcMain.handle('tables:setStatus', (_e, input: { id: string; status: TableStatus }) => {
    setTableStatus(getDb(), input.id, input.status)
  })
  ipcMain.handle('tables:deleteTable', (_e, input: { id: string }) => {
    deleteTable(getDb(), input.id)
  })
}
