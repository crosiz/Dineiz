import type Database from 'better-sqlite3'
import { newId } from '../lib/ids'

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY' | 'INACTIVE'

export interface TableSummary {
  id: string
  floorId: string
  label: string
  seats: number
  posX: number
  posY: number
  status: TableStatus
}

export interface FloorWithTables {
  id: string
  name: string
  sortOrder: number
  tables: TableSummary[]
}

interface FloorRow {
  id: string
  name: string
  sort_order: number
}
interface TableRow {
  id: string
  floor_id: string
  label: string
  seats: number
  pos_x: number
  pos_y: number
  status: TableStatus
}

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const row of rows) {
    const k = key(row)
    ;(out[k] ??= []).push(row)
  }
  return out
}

/** Every floor with its tables nested — mirrors getFullMenu's shape (menu.service.ts) for the same reason: one call, one round trip, load-once-into-memory. */
export function getFullFloorPlan(db: Database.Database): { floors: FloorWithTables[] } {
  const floors = db.prepare('SELECT id, name, sort_order FROM floors ORDER BY sort_order, name').all() as FloorRow[]
  const tables = db
    .prepare('SELECT id, floor_id, label, seats, pos_x, pos_y, status FROM tables ORDER BY label')
    .all() as TableRow[]
  const tablesByFloor = groupBy(tables, (t) => t.floor_id)

  return {
    floors: floors.map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sort_order,
      tables: (tablesByFloor[f.id] ?? []).map((t) => ({
        id: t.id,
        floorId: t.floor_id,
        label: t.label,
        seats: t.seats,
        posX: t.pos_x,
        posY: t.pos_y,
        status: t.status
      }))
    }))
  }
}

// ── Floors ────────────────────────────────────────────────────────────────

export function createFloor(db: Database.Database, input: { name: string; sortOrder?: number }): { id: string } {
  const name = input.name.trim()
  if (!name) throw new Error('Floor name is required')

  const id = newId()
  const sortOrder =
    input.sortOrder ??
    (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM floors').get() as { next: number }).next

  db.prepare('INSERT INTO floors (id, name, sort_order) VALUES (?, ?, ?)').run(id, name, sortOrder)
  return { id }
}

export function renameFloor(db: Database.Database, id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Floor name cannot be empty')
  const result = db.prepare('UPDATE floors SET name = ? WHERE id = ?').run(trimmed, id)
  if (result.changes === 0) throw new Error('Floor not found')
}

export function deleteFloor(db: Database.Database, id: string): void {
  const tableCount = db.prepare('SELECT COUNT(*) AS n FROM tables WHERE floor_id = ?').get(id) as { n: number }
  if (tableCount.n > 0) {
    throw new Error('Cannot delete a floor that still has tables. Move or delete its tables first.')
  }
  const result = db.prepare('DELETE FROM floors WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('Floor not found')
}

// ── Tables ────────────────────────────────────────────────────────────────

export interface CreateTableInput {
  floorId: string
  label: string
  seats?: number
  posX?: number
  posY?: number
}

export function createTable(db: Database.Database, input: CreateTableInput): { id: string } {
  const label = input.label.trim()
  if (!label) throw new Error('Table label is required')
  if (input.seats !== undefined && (!Number.isFinite(input.seats) || input.seats < 1)) {
    throw new Error('Seats must be at least 1')
  }

  const floor = db.prepare('SELECT id FROM floors WHERE id = ?').get(input.floorId)
  if (!floor) throw new Error('Floor not found')

  const duplicate = db
    .prepare('SELECT 1 FROM tables WHERE floor_id = ? AND label = ?')
    .get(input.floorId, label)
  if (duplicate) throw new Error(`A table named "${label}" already exists on this floor`)

  const id = newId()
  db.prepare(
    `INSERT INTO tables (id, floor_id, label, seats, pos_x, pos_y, status)
     VALUES (?, ?, ?, ?, ?, ?, 'FREE')`
  ).run(id, input.floorId, label, Math.round(input.seats ?? 2), input.posX ?? 0, input.posY ?? 0)

  return { id }
}

export interface UpdateTableInput {
  label?: string
  seats?: number
  posX?: number
  posY?: number
}

export function updateTable(db: Database.Database, id: string, input: UpdateTableInput): void {
  const current = db.prepare('SELECT id FROM tables WHERE id = ?').get(id)
  if (!current) throw new Error('Table not found')

  const label = input.label !== undefined ? input.label.trim() : undefined
  if (label !== undefined && !label) throw new Error('Table label cannot be empty')
  if (input.seats !== undefined && (!Number.isFinite(input.seats) || input.seats < 1)) {
    throw new Error('Seats must be at least 1')
  }

  db.prepare(
    `UPDATE tables SET
       label = COALESCE(?, label),
       seats = COALESCE(?, seats),
       pos_x = COALESCE(?, pos_x),
       pos_y = COALESCE(?, pos_y)
     WHERE id = ?`
  ).run(
    label ?? null,
    input.seats !== undefined ? Math.round(input.seats) : null,
    input.posX ?? null,
    input.posY ?? null,
    id
  )
}

/** A DIRTY table (bussed but not yet reset) becoming FREE again is the one status change a staff member sets directly — every other transition (FREE->OCCUPIED, OCCUPIED->FREE) already happens automatically from order lifecycle events (orders.service.ts). */
export function setTableStatus(db: Database.Database, id: string, status: TableStatus): void {
  const result = db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, id)
  if (result.changes === 0) throw new Error('Table not found')
}

export function deleteTable(db: Database.Database, id: string): void {
  const referenced = db.prepare('SELECT 1 FROM orders WHERE table_id = ? LIMIT 1').get(id)
  if (referenced) {
    throw new Error('Cannot delete a table that has order history. Mark it inactive instead.')
  }
  const table = db.prepare('SELECT status FROM tables WHERE id = ?').get(id) as { status: TableStatus } | undefined
  if (!table) throw new Error('Table not found')
  if (table.status === 'OCCUPIED') {
    throw new Error('Cannot delete a table that is currently occupied')
  }
  db.prepare('DELETE FROM tables WHERE id = ?').run(id)
}
