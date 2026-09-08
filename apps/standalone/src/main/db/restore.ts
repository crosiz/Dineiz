import type Database from 'better-sqlite3'
import { copyFile, rm } from 'node:fs/promises'
import { recordBackupRow, writeBackupFile } from '../services/backup.service'
import { runMigrations } from './migrate'

export interface RestoreDeps {
  liveDbPath: string
  backupDir: string
  /** Closes the caller's current db handle (and nulls whatever singleton reference holds it). */
  closeCurrentDb: () => void
  /** Opens a fresh connection to liveDbPath (and updates the singleton reference) after the file has been replaced. */
  openNewDb: () => Database.Database
}

/**
 * Restores the live database from a backup file. Always snapshots the
 * current live db first (trigger PRE_RESTORE) so a restore is itself always
 * recoverable — even restoring the wrong file can't lose data permanently.
 * Kept free of Electron imports (paths and the close/open callbacks are
 * supplied by the caller) specifically so this can run in the dev harness
 * against throwaway files, the same as every other DB-touching function.
 *
 * The safety snapshot's *file* is written from the OLD db (before it's
 * replaced), but its bookkeeping row is written into the NEW db afterward —
 * a row inserted into the old db first would just be discarded along with
 * every other table in that file the moment its bytes are overwritten by
 * the restored backup's content. See writeBackupFile's doc comment.
 */
export async function performRestore(
  currentDb: Database.Database,
  backupFilePath: string,
  deps: RestoreDeps
): Promise<Database.Database> {
  const safetySnapshot = await writeBackupFile(currentDb, deps.backupDir, 'PRE_RESTORE')

  deps.closeCurrentDb()

  await copyFile(backupFilePath, deps.liveDbPath)
  // Stale WAL/SHM sidecars from the old connection don't apply to the
  // restored file's contents — remove them so SQLite starts clean.
  await rm(`${deps.liveDbPath}-wal`, { force: true })
  await rm(`${deps.liveDbPath}-shm`, { force: true })

  const newDb = deps.openNewDb()
  runMigrations(newDb) // idempotent — a valid backup is already at the current schema version
  recordBackupRow(newDb, safetySnapshot, 'PRE_RESTORE')
  return newDb
}
