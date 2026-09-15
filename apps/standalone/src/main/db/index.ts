import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { runMigrations } from './migrate'
import { performRestore } from './restore'

let db: Database.Database | null = null

function liveDbPath(): string {
  return join(app.getPath('userData'), 'dineiz.db')
}

export function backupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

function openLiveDb(): Database.Database {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  db = new Database(liveDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function initDatabase(): Database.Database {
  const database = openLiveDb()
  runMigrations(database)
  return database
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}

/** Restores the live db from a backup file, snapshotting the current one first. Returns the new live connection. */
export async function restoreFromBackup(backupFilePath: string): Promise<Database.Database> {
  const current = getDb()
  return performRestore(current, backupFilePath, {
    liveDbPath: liveDbPath(),
    backupDir: backupDir(),
    closeCurrentDb: () => {
      current.close()
      db = null
    },
    openNewDb: openLiveDb
  })
}
