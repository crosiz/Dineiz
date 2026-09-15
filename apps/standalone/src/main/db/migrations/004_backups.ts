export const migration004Backups = `
CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('MANUAL', 'HOURLY', 'SHIFT_CLOSE', 'DAILY', 'MONTHLY', 'PRE_RESTORE')),
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_backups_created_at ON backups(created_at);
`
