import type Database from 'better-sqlite3'
import { newId } from '../lib/ids'

export interface VariationSummary {
  id: string
  name: string
  price: number
  sortOrder: number
}

export interface AddonSummary {
  id: string
  name: string
  price: number
  sortOrder: number
}

export interface ItemSummary {
  id: string
  categoryId: string
  name: string
  price: number
  isAvailable: boolean
  imagePath: string | null
  sortOrder: number
  variations: VariationSummary[]
  addons: AddonSummary[]
}

export interface CategoryWithItems {
  id: string
  name: string
  sortOrder: number
  items: ItemSummary[]
}

interface CategoryRow {
  id: string
  name: string
  sort_order: number
}
interface ItemRow {
  id: string
  category_id: string
  name: string
  price: number
  is_available: number
  image_path: string | null
  sort_order: number
}
interface VariationRow {
  id: string
  item_id: string
  name: string
  price: number
  sort_order: number
}
interface AddonRow {
  id: string
  item_id: string
  name: string
  price: number
  sort_order: number
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const row of rows) {
    const k = key(row)
    ;(out[k] ??= []).push(row)
  }
  return out
}

function assertNonNegativePrice(price: number, label: string): void {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${label} price must be a non-negative number`)
  }
}

export function getFullMenu(db: Database.Database): { categories: CategoryWithItems[] } {
  const categories = db
    .prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order, name')
    .all() as CategoryRow[]
  const items = db
    .prepare('SELECT id, category_id, name, price, is_available, image_path, sort_order FROM items ORDER BY sort_order, name')
    .all() as ItemRow[]
  const variations = db
    .prepare('SELECT id, item_id, name, price, sort_order FROM variations ORDER BY sort_order, name')
    .all() as VariationRow[]
  const addons = db
    .prepare('SELECT id, item_id, name, price, sort_order FROM addons ORDER BY sort_order, name')
    .all() as AddonRow[]

  const variationsByItem = groupBy(variations, (v) => v.item_id)
  const addonsByItem = groupBy(addons, (a) => a.item_id)
  const itemsByCategory = groupBy(items, (i) => i.category_id)

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order,
      items: (itemsByCategory[c.id] ?? []).map((i) => ({
        id: i.id,
        categoryId: i.category_id,
        name: i.name,
        price: i.price,
        isAvailable: Boolean(i.is_available),
        imagePath: i.image_path,
        sortOrder: i.sort_order,
        variations: (variationsByItem[i.id] ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          sortOrder: v.sort_order
        })),
        addons: (addonsByItem[i.id] ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          sortOrder: a.sort_order
        }))
      }))
    }))
  }
}

// ── Categories ────────────────────────────────────────────────────────────

export function createCategory(db: Database.Database, input: { name: string; sortOrder?: number }): { id: string } {
  const name = input.name.trim()
  if (!name) throw new Error('Category name is required')

  const id = newId()
  const sortOrder =
    input.sortOrder ??
    ((db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories').get() as { next: number })
      .next)

  db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)').run(id, name, sortOrder)
  return { id }
}

export function updateCategory(
  db: Database.Database,
  id: string,
  input: { name?: string; sortOrder?: number }
): void {
  const current = db.prepare('SELECT id FROM categories WHERE id = ?').get(id)
  if (!current) throw new Error('Category not found')

  const name = input.name !== undefined ? input.name.trim() : undefined
  if (name !== undefined && !name) throw new Error('Category name cannot be empty')

  db.prepare(
    `UPDATE categories SET
       name = COALESCE(?, name),
       sort_order = COALESCE(?, sort_order),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(name ?? null, input.sortOrder ?? null, id)
}

export function deleteCategory(db: Database.Database, id: string): void {
  const itemCount = db.prepare('SELECT COUNT(*) AS n FROM items WHERE category_id = ?').get(id) as { n: number }
  if (itemCount.n > 0) {
    throw new Error('Cannot delete a category that still has menu items. Move or delete its items first.')
  }
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Category not found')
}

export function reorderCategories(db: Database.Database, orderedIds: string[]): void {
  const update = db.prepare("UPDATE categories SET sort_order = ?, updated_at = datetime('now') WHERE id = ?")
  const run = db.transaction((ids: string[]) => {
    ids.forEach((id, index) => update.run(index, id))
  })
  run(orderedIds)
}

// ── Items ─────────────────────────────────────────────────────────────────

export interface CreateItemInput {
  categoryId: string
  name: string
  price: number
  imagePath?: string | null
  sortOrder?: number
}

export function createItem(db: Database.Database, input: CreateItemInput): { id: string } {
  const name = input.name.trim()
  if (!name) throw new Error('Item name is required')
  assertNonNegativePrice(input.price, 'Item')

  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(input.categoryId)
  if (!category) throw new Error('Category not found')

  const id = newId()
  const sortOrder =
    input.sortOrder ??
    (
      db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM items WHERE category_id = ?')
        .get(input.categoryId) as { next: number }
    ).next

  db.prepare(
    `INSERT INTO items (id, category_id, name, price, image_path, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.categoryId, name, Math.round(input.price), input.imagePath ?? null, sortOrder)

  return { id }
}

export interface UpdateItemInput {
  categoryId?: string
  name?: string
  price?: number
  imagePath?: string | null
  sortOrder?: number
}

export function updateItem(db: Database.Database, id: string, input: UpdateItemInput): void {
  const current = db.prepare('SELECT id FROM items WHERE id = ?').get(id)
  if (!current) throw new Error('Item not found')

  const name = input.name !== undefined ? input.name.trim() : undefined
  if (name !== undefined && !name) throw new Error('Item name cannot be empty')
  if (input.price !== undefined) assertNonNegativePrice(input.price, 'Item')
  if (input.categoryId !== undefined) {
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(input.categoryId)
    if (!category) throw new Error('Category not found')
  }

  db.prepare(
    `UPDATE items SET
       category_id = COALESCE(?, category_id),
       name = COALESCE(?, name),
       price = COALESCE(?, price),
       image_path = COALESCE(?, image_path),
       sort_order = COALESCE(?, sort_order),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    input.categoryId ?? null,
    name ?? null,
    input.price !== undefined ? Math.round(input.price) : null,
    input.imagePath ?? null,
    input.sortOrder ?? null,
    id
  )
}

export function setItemAvailability(db: Database.Database, id: string, isAvailable: boolean): void {
  const result = db
    .prepare("UPDATE items SET is_available = ?, updated_at = datetime('now') WHERE id = ?")
    .run(isAvailable ? 1 : 0, id)
  if (result.changes === 0) throw new Error('Item not found')
}

function assertItemNeverOrdered(db: Database.Database, itemId: string): void {
  const row = db.prepare('SELECT 1 FROM order_items WHERE item_id = ? LIMIT 1').get(itemId)
  if (row) {
    throw new Error('Cannot delete an item that has appeared in a past order. Mark it unavailable instead.')
  }
}

export function deleteItem(db: Database.Database, id: string): void {
  assertItemNeverOrdered(db, id)
  const run = db.transaction(() => {
    db.prepare('DELETE FROM variations WHERE item_id = ?').run(id)
    db.prepare('DELETE FROM addons WHERE item_id = ?').run(id)
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(id)
    if (result.changes === 0) throw new Error('Item not found')
  })
  run()
}

// ── Variations ────────────────────────────────────────────────────────────

export function createVariation(
  db: Database.Database,
  input: { itemId: string; name: string; price: number; sortOrder?: number }
): { id: string } {
  const name = input.name.trim()
  if (!name) throw new Error('Variation name is required')
  assertNonNegativePrice(input.price, 'Variation')

  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(input.itemId)
  if (!item) throw new Error('Item not found')

  const id = newId()
  const sortOrder =
    input.sortOrder ??
    (
      db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM variations WHERE item_id = ?')
        .get(input.itemId) as { next: number }
    ).next

  db.prepare('INSERT INTO variations (id, item_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.itemId,
    name,
    Math.round(input.price),
    sortOrder
  )
  return { id }
}

export function updateVariation(
  db: Database.Database,
  id: string,
  input: { name?: string; price?: number; sortOrder?: number }
): void {
  const current = db.prepare('SELECT id FROM variations WHERE id = ?').get(id)
  if (!current) throw new Error('Variation not found')
  const name = input.name !== undefined ? input.name.trim() : undefined
  if (name !== undefined && !name) throw new Error('Variation name cannot be empty')
  if (input.price !== undefined) assertNonNegativePrice(input.price, 'Variation')

  db.prepare(
    `UPDATE variations SET
       name = COALESCE(?, name),
       price = COALESCE(?, price),
       sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(name ?? null, input.price !== undefined ? Math.round(input.price) : null, input.sortOrder ?? null, id)
}

export function deleteVariation(db: Database.Database, id: string): void {
  const ordered = db.prepare('SELECT 1 FROM order_items WHERE variation_id = ? LIMIT 1').get(id)
  if (ordered) {
    throw new Error('Cannot delete a variation that has appeared in a past order.')
  }
  const result = db.prepare('DELETE FROM variations WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Variation not found')
}

// ── Add-ons ───────────────────────────────────────────────────────────────
// Order-time add-on selections are stored as a JSON snapshot on order_items
// (addons_json), not a live FK — so unlike variations, deleting an add-on
// can never break a historical order row.

export function createAddon(
  db: Database.Database,
  input: { itemId: string; name: string; price: number; sortOrder?: number }
): { id: string } {
  const name = input.name.trim()
  if (!name) throw new Error('Add-on name is required')
  assertNonNegativePrice(input.price, 'Add-on')

  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(input.itemId)
  if (!item) throw new Error('Item not found')

  const id = newId()
  const sortOrder =
    input.sortOrder ??
    (
      db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM addons WHERE item_id = ?')
        .get(input.itemId) as { next: number }
    ).next

  db.prepare('INSERT INTO addons (id, item_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.itemId,
    name,
    Math.round(input.price),
    sortOrder
  )
  return { id }
}

export function updateAddon(
  db: Database.Database,
  id: string,
  input: { name?: string; price?: number; sortOrder?: number }
): void {
  const current = db.prepare('SELECT id FROM addons WHERE id = ?').get(id)
  if (!current) throw new Error('Add-on not found')
  const name = input.name !== undefined ? input.name.trim() : undefined
  if (name !== undefined && !name) throw new Error('Add-on name cannot be empty')
  if (input.price !== undefined) assertNonNegativePrice(input.price, 'Add-on')

  db.prepare(
    `UPDATE addons SET
       name = COALESCE(?, name),
       price = COALESCE(?, price),
       sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(name ?? null, input.price !== undefined ? Math.round(input.price) : null, input.sortOrder ?? null, id)
}

export function deleteAddon(db: Database.Database, id: string): void {
  const result = db.prepare('DELETE FROM addons WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Add-on not found')
}
