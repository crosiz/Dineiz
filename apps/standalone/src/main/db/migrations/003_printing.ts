export const migration003Printing = `
CREATE TABLE printers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('RECEIPT', 'KITCHEN')),
  connection_type TEXT NOT NULL CHECK (connection_type IN ('NETWORK', 'WINDOWS', 'PDF_ONLY')),
  os_printer_name TEXT,
  network_host TEXT,
  network_port INTEGER NOT NULL DEFAULT 9100,
  paper_width_mm INTEGER NOT NULL DEFAULT 80,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  printer_id TEXT NOT NULL REFERENCES printers(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('RECEIPT', 'KOT', 'CANCELLATION_KOT')),
  order_id TEXT REFERENCES orders(id),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PRINTING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_print_jobs_status_next_attempt ON print_jobs(status, next_attempt_at);
CREATE INDEX idx_print_jobs_order ON print_jobs(order_id);
`
