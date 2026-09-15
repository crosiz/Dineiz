import type Database from 'better-sqlite3'
import { migrations } from './migrations'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row) => (row as { name: string }).name)
  )
  const insertMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)')

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue

    const apply = db.transaction(() => {
      db.exec(migration.sql)
      insertMigration.run(migration.name)
    })
    apply()
  }
}
