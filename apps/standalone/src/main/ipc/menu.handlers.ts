import type { IpcMain } from 'electron'
import { getDb } from '../db'
import {
  createAddon,
  createCategory,
  createItem,
  createVariation,
  deleteAddon,
  deleteCategory,
  deleteItem,
  deleteVariation,
  getFullMenu,
  reorderCategories,
  setItemAvailability,
  updateAddon,
  updateCategory,
  updateItem,
  updateVariation,
  type CreateItemInput,
  type UpdateItemInput
} from '../services/menu.service'

export function registerMenuHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('menu:getAll', () => getFullMenu(getDb()))

  ipcMain.handle('menu:createCategory', (_e, input: { name: string; sortOrder?: number }) =>
    createCategory(getDb(), input)
  )
  ipcMain.handle(
    'menu:updateCategory',
    (_e, input: { id: string; name?: string; sortOrder?: number }) => {
      updateCategory(getDb(), input.id, input)
    }
  )
  ipcMain.handle('menu:deleteCategory', (_e, input: { id: string }) => {
    deleteCategory(getDb(), input.id)
  })
  ipcMain.handle('menu:reorderCategories', (_e, input: { orderedIds: string[] }) => {
    reorderCategories(getDb(), input.orderedIds)
  })

  ipcMain.handle('menu:createItem', (_e, input: CreateItemInput) => createItem(getDb(), input))
  ipcMain.handle('menu:updateItem', (_e, input: { id: string } & UpdateItemInput) => {
    updateItem(getDb(), input.id, input)
  })
  ipcMain.handle('menu:setItemAvailability', (_e, input: { id: string; isAvailable: boolean }) => {
    setItemAvailability(getDb(), input.id, input.isAvailable)
  })
  ipcMain.handle('menu:deleteItem', (_e, input: { id: string }) => {
    deleteItem(getDb(), input.id)
  })

  ipcMain.handle(
    'menu:createVariation',
    (_e, input: { itemId: string; name: string; price: number; sortOrder?: number }) =>
      createVariation(getDb(), input)
  )
  ipcMain.handle(
    'menu:updateVariation',
    (_e, input: { id: string; name?: string; price?: number; sortOrder?: number }) => {
      updateVariation(getDb(), input.id, input)
    }
  )
  ipcMain.handle('menu:deleteVariation', (_e, input: { id: string }) => {
    deleteVariation(getDb(), input.id)
  })

  ipcMain.handle(
    'menu:createAddon',
    (_e, input: { itemId: string; name: string; price: number; sortOrder?: number }) =>
      createAddon(getDb(), input)
  )
  ipcMain.handle(
    'menu:updateAddon',
    (_e, input: { id: string; name?: string; price?: number; sortOrder?: number }) => {
      updateAddon(getDb(), input.id, input)
    }
  )
  ipcMain.handle('menu:deleteAddon', (_e, input: { id: string }) => {
    deleteAddon(getDb(), input.id)
  })
}
