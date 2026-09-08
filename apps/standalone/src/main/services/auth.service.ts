import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@dineiz/pos-logic'
import { newId } from '../lib/ids'

export interface StaffSummary {
  id: string
  name: string
  role: UserRole
  isActive: boolean
}

export interface AuthSuccess {
  ok: true
  user: StaffSummary
}
export interface AuthFailure {
  ok: false
  reason: 'NOT_FOUND' | 'INACTIVE' | 'INVALID_CREDENTIALS'
}
export type AuthResult = AuthSuccess | AuthFailure

interface UserCredentialRow {
  id: string
  name: string
  role: UserRole
  is_active: number
  password_hash: string | null
  pin_hash: string | null
}

function getCredentialRow(db: Database.Database, userId: string): UserCredentialRow | undefined {
  return db
    .prepare('SELECT id, name, role, is_active, password_hash, pin_hash FROM users WHERE id = ?')
    .get(userId) as UserCredentialRow | undefined
}

function toSummary(row: UserCredentialRow): StaffSummary {
  return { id: row.id, name: row.name, role: row.role, isActive: Boolean(row.is_active) }
}

/** Never selects password_hash/pin_hash — this is the list shown before login. */
export function listActiveStaff(db: Database.Database): StaffSummary[] {
  const rows = db
    .prepare('SELECT id, name, role, is_active FROM users WHERE is_active = 1 ORDER BY name')
    .all() as { id: string; name: string; role: UserRole; is_active: number }[]
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, isActive: Boolean(r.is_active) }))
}

/** Includes inactive staff too — for the staff management screen, where a manager needs to reactivate someone. */
export function listAllStaff(db: Database.Database): StaffSummary[] {
  const rows = db.prepare('SELECT id, name, role, is_active FROM users ORDER BY is_active DESC, name').all() as {
    id: string
    name: string
    role: UserRole
    is_active: number
  }[]
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, isActive: Boolean(r.is_active) }))
}

export function login(
  db: Database.Database,
  input: { userId: string; password?: string; pin?: string },
): AuthResult {
  const row = getCredentialRow(db, input.userId)
  if (!row) return { ok: false, reason: 'NOT_FOUND' }
  if (!row.is_active) return { ok: false, reason: 'INACTIVE' }

  if (input.password != null) {
    if (!row.password_hash || !bcrypt.compareSync(input.password, row.password_hash)) {
      return { ok: false, reason: 'INVALID_CREDENTIALS' }
    }
  } else if (input.pin != null) {
    if (!row.pin_hash || !bcrypt.compareSync(input.pin, row.pin_hash)) {
      return { ok: false, reason: 'INVALID_CREDENTIALS' }
    }
  } else {
    return { ok: false, reason: 'INVALID_CREDENTIALS' }
  }

  return { ok: true, user: toSummary(row) }
}

export function createUser(
  db: Database.Database,
  input: { name: string; role: UserRole; email?: string; password?: string; pin?: string },
): StaffSummary {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  if (input.role === 'OWNER' && !input.password) throw new Error('Owner accounts require a password')
  if (input.role !== 'OWNER' && !input.pin && !input.password) {
    throw new Error('Staff accounts require a PIN or password')
  }
  if (input.pin && !/^\d{4,6}$/.test(input.pin)) throw new Error('PIN must be 4-6 digits')
  if (input.password && input.password.length < 6) throw new Error('Password must be at least 6 characters')

  const id = newId()
  const passwordHash = input.password ? bcrypt.hashSync(input.password, 10) : null
  const pinHash = input.pin ? bcrypt.hashSync(input.pin, 10) : null

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, pin_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ).run(id, name, input.email ?? null, passwordHash, pinHash, input.role)

  return { id, name, role: input.role, isActive: true }
}

export function setUserActive(db: Database.Database, userId: string, isActive: boolean): void {
  const result = db
    .prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?")
    .run(isActive ? 1 : 0, userId)
  if (result.changes === 0) throw new Error('User not found')
}

export function changePassword(db: Database.Database, userId: string, newPassword: string): void {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')
  const hash = bcrypt.hashSync(newPassword, 10)
  const result = db
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(hash, userId)
  if (result.changes === 0) throw new Error('User not found')
}

export function changePin(db: Database.Database, userId: string, newPin: string): void {
  if (!/^\d{4,6}$/.test(newPin)) throw new Error('PIN must be 4-6 digits')
  const hash = bcrypt.hashSync(newPin, 10)
  const result = db
    .prepare("UPDATE users SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(hash, userId)
  if (result.changes === 0) throw new Error('User not found')
}
