import type Database from 'better-sqlite3'
import { mkdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { newId } from '../lib/ids'

export type BackupTrigger = 'MANUAL' | 'HOURLY' | 'SHIFT_CLOSE' | 'DAILY' | 'MONTHLY' | 'PRE_RESTORE'

export interface BackupRow {
  id: string
  file_path: string
  trigger_type: BackupTrigger
  size_bytes: number
  created_at: string
}

// better-sqlite3's runtime has Database.prototype.backup() (the official
// online-backup API — safe to call while the db is open under WAL, unlike a
// raw file copy) but @types/better-sqlite3 doesn't declare it.
type BackupCapableDb = Database.Database & { backup(filename: string): Promise<unknown> }

export interface BackupFile {
  filePath: string
  sizeBytes: number
}

/**
 * Writes the backup file only — no bookkeeping row. Split out from
 * `createBackup` for restore's sake: a pre-restore safety snapshot must be
 * written from the OLD db (the thing about to be discarded), but its
 * bookkeeping row has to land in the NEW db that replaces it — the old db's
 * `backups` table is destroyed along with everything else in that file the
 * moment the restore's file copy happens, so a row written there first
 * would just vanish along with it. See db/restore.ts.
 */
export async function writeBackupFile(db: Database.Database, backupDir: string, triggerType: BackupTrigger): Promise<BackupFile> {
  await mkdir(backupDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = join(backupDir, `dineiz-backup-${timestamp}-${triggerType.toLowerCase()}.db`)

  await (db as BackupCapableDb).backup(filePath)

  const stats = await stat(filePath)
  return { filePath, sizeBytes: stats.size }
}

export function recordBackupRow(db: Database.Database, file: BackupFile, triggerType: BackupTrigger): BackupRow {
  const id = newId()
  db.prepare('INSERT INTO backups (id, file_path, trigger_type, size_bytes) VALUES (?, ?, ?, ?)').run(
    id,
    file.filePath,
    triggerType,
    file.sizeBytes
  )
  return db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as BackupRow
}

export async function createBackup(db: Database.Database, backupDir: string, triggerType: BackupTrigger): Promise<BackupRow> {
  const file = await writeBackupFile(db, backupDir, triggerType)
  return recordBackupRow(db, file, triggerType)
}

export function listBackups(db: Database.Database): BackupRow[] {
  return db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all() as BackupRow[]
}

export function getBackup(db: Database.Database, id: string): BackupRow {
  const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as BackupRow | undefined
  if (!row) throw new Error('Backup not found')
  return row
}

export async function deleteBackup(db: Database.Database, id: string): Promise<void> {
  const row = getBackup(db, id)
  await rm(row.file_path, { force: true })
  db.prepare('DELETE FROM backups WHERE id = ?').run(id)
}

// ── Scheduled backups ────────────────────────────────────────────────────────
// app_meta already exists for exactly this (key/value, no migration needed).

const META_KEYS: Record<'HOURLY' | 'DAILY' | 'MONTHLY', string> = {
  HOURLY: 'last_hourly_backup_at',
  DAILY: 'last_daily_backup_at',
  MONTHLY: 'last_monthly_backup_at'
}

function getMeta(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value
  )
}

function isDue(lastRunIso: string | null, now: Date, kind: 'HOURLY' | 'DAILY' | 'MONTHLY'): boolean {
  if (!lastRunIso) return true
  const last = new Date(lastRunIso)
  if (kind === 'HOURLY') return now.getTime() - last.getTime() >= 60 * 60 * 1000
  if (kind === 'DAILY') return now.toDateString() !== last.toDateString()
  return now.getFullYear() !== last.getFullYear() || now.getMonth() !== last.getMonth()
}

/**
 * Called on a timer (every few minutes is plenty — this only actually backs
 * up when a schedule is genuinely due). Never throws: a failed scheduled
 * backup must not crash the app or block anything else.
 */
export async function maybeRunScheduledBackups(db: Database.Database, backupDir: string): Promise<void> {
  const now = new Date()
  for (const kind of ['HOURLY', 'DAILY', 'MONTHLY'] as const) {
    try {
      if (isDue(getMeta(db, META_KEYS[kind]), now, kind)) {
        await createBackup(db, backupDir, kind)
        setMeta(db, META_KEYS[kind], now.toISOString())
      }
    } catch (err) {
      console.error(`[backup] scheduled ${kind} backup failed`, err)
    }
  }
}
